import { ulid } from 'ulidx';
import { PassThrough } from 'stream';
import * as k8s from '@kubernetes/client-node';
import { db } from './db';
import { JobInstance } from '../types/agent-task';
import { JobDefinition, PipelineDefinition, StageDefinition } from '../types/pipeline';
import { randomString } from './util';

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
const k8sLog = new k8s.Log(kc);

const pollInterval = parseInt(process.env['KUBE_JOB_POLL_INTERVAL'] || "2000");
const maxPollTime = parseInt(process.env['KUBE_JOB_MAX_POLL_TIME']  || "60000");

const jobStreams: {
    [key: string]: {
        stream: PassThrough,
        req: any
    }
} = {};

const OnJobComplete = async (pipeline: PipelineDefinition, job: JobInstance, success = true) => {
    pipeline.stats = pipeline.stats ?? { runCount: 0, successCount: 0, failCount: 0, totalRuntime: 0 };

    if (success) {
        pipeline.stats.successCount += 1;
    }
    else {
        pipeline.stats.failCount += 1;
    }

    pipeline.stats.totalRuntime += job.endEpoch - job.cloneEpoch;

    db.merge(pipeline.id, {stats: pipeline.stats});
}

export async function StartAgent(pipeline: PipelineDefinition, stage: StageDefinition) {
    return Promise.all(stage.jobs?.map(j => StartAgentJob(pipeline, stage, j)));
}

export async function StartAgentJob(pipeline: PipelineDefinition, stage: any, job: JobDefinition) {

    if (job.taskGroups?.length < 1) {
        return -1;
    }

    let elasticAgentTemplate: any;
    if (job.elasticAgentId) {
        const [ap] = (await db.query(job.elasticAgentId)) as any as any[];
        elasticAgentTemplate = ap;
    }
    const namespace = elasticAgentTemplate?.kubeNamespace || process.env['CRUISER_AGENT_NAMESPACE'] || "cruiser";
    const id = ulid();
    const podId = id.toLowerCase();
    const kubeAuthnToken = randomString(128);
    const podName = `cruiser-ea-${podId}`;

    // Mark all other job instances as non-latest
    await db.query(`UPDATE jobs SET latest = false WHERE job.id = '${job.id}'`);

    const [ instance ] = (await db.create(`jobs:${id}`, {
        state: "queued",
        queueTime: Date.now(),
        errorCount: 0,
        warnCount: 0,
        job: job.id,
        is_instance: true,
        instance_number: job.runCount,
        latest: true,
        pipeline: pipeline.id,
        stage: stage.id,
        kubeNamespace: namespace,
        kubePodName: podName,
        kubeAuthnToken
    })) as any as JobInstance[];

    instance.queueEpoch = Date.now();
    db.merge(instance.id, instance);
    db.merge(job.id, { runCount: job.runCount + 1});


    const environment: { name: string, value: string; }[] =
        (await db.query(`RETURN fn::job_get_environment(${job.id})`) as any[])
        .map(({key, value}) => ({name: key, value}))
        .filter(e => e.name != undefined);

    // await k8sApi.createNamespace({
    //     metadata: {
    //         name: namespace
    //     }
    // })
    // .catch(e => { if (e.body?.reason != 'AlreadyExists') throw e; });


    const result = await k8sBatchApi.createNamespacedJob(namespace, {
        apiVersion: "batch/v1",
        kind: "Job",
        metadata: {
            annotations: {
                "Created_By": "$cruiser",
                "Job_Id": id,
                ...elasticAgentTemplate?.kubeContainerAnnotations
            },
            labels: elasticAgentTemplate?.kubeContainerLabels,
            name: podName,
        },
        spec: {
            activeDeadlineSeconds: Number.MAX_SAFE_INTEGER,
            template: {
                metadata: {
                    annotations: {
                        "Created_By": "$cruiser",
                        "Pod_Id": podId,
                        "Job_Id": id
                    }
                },
                spec: {
                    tolerations: elasticAgentTemplate?.kubeContainerTolerations,
                    restartPolicy: "Never",
                    containers: [
                        {
                            name: podName,
                            image: elasticAgentTemplate?.kubeContainerImage || "ghcr.io/knackstedt/cruiser/cruiser-agent:latest",
                            imagePullPolicy: 'Always',
                            securityContext: {
                                privileged: true
                            },
                            resources: {
                                limits: {
                                    cpu: elasticAgentTemplate?.kubeCpuLimit,
                                    memory: elasticAgentTemplate?.kubeMemLimit
                                },
                                requests: {
                                    cpu: elasticAgentTemplate?.kubeCpuRequest,
                                    memory: elasticAgentTemplate?.kubeMemRequest
                                }
                            },
                            ports: [{ containerPort: 8080 }],
                            env: [
                                // TODO: pass surreal connection string
                                // consider using HTTP POST instead.
                                { name: "CI_ENVIRONMENT", value: "cruiser" },
                                // TODO: calculate this value by introspecting the server
                                // hostname -i => ip address
                                { name: "DOTGLITCH_DOTOPS_CLUSTER_URL", value: process.env['DOTGLITCH_DOTOPS_CLUSTER_URL'] },
                                { name: "DOTGLITCH_AGENT_ID", value: id },
                                { name: "DOTOPS_WEBSERVER_TOKEN", value: kubeAuthnToken },
                                ...environment
                            ]
                        }
                    ]
                }
            }
        }
    });

    let kubeJob = result.body;
    const kubeJobMetadata = kubeJob.metadata;

    await db.merge(instance.id, {
        jobUid: kubeJobMetadata.uid,
    });

    /**
     * It exists so that we can create a log stream and automatically detach from the container
     * when the pods are done
     */
    // return new Promise((resolve, reject) => {
    //     const stream = new PassThrough();

    //     let pollTime = 0;
    //     let hasAttached = false;

    //     const i = setInterval(async () => {

    //         // TODO: How do we fetch the job when we know the uid?
    //         const { body: result } = await k8sBatchApi.listNamespacedJob(namespace);
    //         kubeJob = result.items.find(j => j.metadata.uid == kubeJobMetadata.uid);

    //         if (hasAttached) {

    //             // This will keep running after the promise initially resolves
    //             // Thus, we do not resolve the promise here.
    //             if (kubeJob.status.active == 0) {
    //                 clearInterval(i);
    //                 logger.info("Job has stopped, closing log stream");
    //                 stream.destroy();
    //                 delete jobStreams[podName];
    //                 job.endTime = Date.now();
    //                 db.merge(job.id, job);
    //                 OnJobComplete(pipeline, instance);
    //             }
    //         }
    //         else {
    //             if (kubeJob.status.active > 0) {
    //                 hasAttached = true;

    //                 logger.info("Found log stream for launched job");

    //                 const { body: pods } = await k8sApi.listNamespacedPod(namespace);
    //                 const jobPod = pods.items.find(p => p.metadata.annotations?.['job_id'] == podId);

    //                 try {
    //                     const req = await k8sLog.log(namespace, jobPod.metadata.name, podName, stream, {
    //                         follow: true,
    //                         pretty: false,
    //                         timestamps: false,
    //                     });

    //                     jobStreams[podName] = {
    //                         stream: stream,
    //                         req
    //                     };

    //                     stream.on('data', data => {
    //                         db.create("joblogs:ulid()", {
    //                             job: instance.id,
    //                             msg: new TextDecoder().decode(data)
    //                         })
    //                     })

    //                     resolve(stream);
    //                 }
    //                 catch (err) {
    //                     console.warn(err)
    //                     // debugger;
    //                 }

    //                 return;
    //             }

    //             if (pollTime >= maxPollTime) {
    //                 clearInterval(i);
    //                 logger.warn("Gave up waiting to attach to log stream");
    //                 stream.destroy();
    //                 return reject();
    //             }

    //             pollTime += pollInterval;
    //         }
    //     }, pollInterval)
    // })
    return instance;
}

export async function PauseAgentJob(pipeline: PipelineDefinition, job: JobDefinition) {
    // TODO
}
