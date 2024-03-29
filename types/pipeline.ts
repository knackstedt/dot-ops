import * as k8s from '@kubernetes/client-node';
import { HistoryObject } from './history-object';
import { EnvironmentVariable } from './environment';
import { AxiosProxyConfig } from 'axios';

export type BuildArtifact = {
    id: `artifact:${string}`
    label: string
    description?: string
    source: string
    destination: string,
    compressionAlgorithm?: "lrzip" | "gzip" | "zip" | "zstd" | "zstd_max" | "bzip" | "plzip" | "plzip_max" | "xz" | "xz_max";
}

export type TaskDefinition = {
    id: `pipeline_task:${string}`;
    disabled: boolean,
    commandTimeout: number
    label: string
    description?: string
    workingDirectory?: string
    order: number

    runIfPreviousTaskPassed: boolean
    runIfPreviousTaskFailed: boolean
    preBreakpoint: boolean
    postBreakpoint: boolean
    disableErrorBreakpoint: boolean

    numberOfFailureRetries: number
    continueOnError: boolean,


    //taskOnSelfFailure: TaskDefinition

    environment?: EnvironmentVariable[]

    // Id of the agent container script the task will run
    // defaults to `command`
    taskScriptId: string
    // For task scripts that have more than 1 command, enable
    // specifying the command to execute
    taskScriptSubId: string
    // Arguments to be fed into the specified task script.
    taskScriptArguments: Object
}

export type TaskGroupDefinition = {
    id: `pipeline_task_group:${string}`
    label: string
    description?: string
    order: number
    disabled?: boolean


    environment?: EnvironmentVariable[]
    tasks?: TaskDefinition[]
}

export type JobDefinition = {
    id: `pipeline_job:${string}`;
    label: string
    description?: string
    order: number
    disabled?: boolean

    jobInstance?: string,

    elasticAgentId?: string
    timeout?: string
    lastRun?: string
    lastTriggerReason?: "cron" | "changes" | "manual" | "webhook"
    runState?: "success" | "fail" | "running"

    taskGroups: TaskGroupDefinition[]
    artifacts?: BuildArtifact[]
    environment?: EnvironmentVariable[]

    kubeNamespace?: string,
    kubeJobAnnotations?: { [key: string]: string },
    kubeJobLabels?: { [key: string]: string },
    kubeContainerTolerations?: k8s.V1Toleration[];
    kubeContainerAnnotations?: { [key: string]: string },
    kubeContainerLabels?: { [key: string]: string },
    kubeContainerImage?: string,
    kubeCpuLimit?: string;
    kubeMemLimit?: string;
    kubeCpuRequest?: string;
    kubeMemRequest?: string;

    platform?: `agent_${string}` | 'agentless' | `kube_${string}`
}

export type Webhook = {
    id: `pipeline_stage_webhook:${string}`,
    label: string,
    description?: string,

    url?: string,
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    headers?: [string, string][],
    body?: string,
    proxy?: AxiosProxyConfig;

    // For the webhook instance, we will set state
    state?: "success" | "fail";

    executeOnFailure?: boolean
}

export type StageDefinition = {
    id: `pipeline_stage:${string}`
    renderAsGateway?: boolean
    label: string
    description?: string
    lastRunState?: string
    order: number
    onlyOnPreviousSuccess?: boolean
    fetchSources?: boolean
    cleanupArtifacts?: boolean
    cleanDirectory?: boolean
    autoTriggerOnPreviousStageCompletion?: boolean
    environment?: EnvironmentVariable[]
    jobs?: JobDefinition[],

    sources?: SourceConfiguration[];

    stageTrigger?: string[]
    cronTrigger?: string,
    cronExcludeAuto?: boolean,
    approvalUsers?: string[], // users who may approve the pipeline
    requiredApprovals?: number, // number of approvals before it may be normally run
    webhooks?: Webhook[];
    runCount?: number;

    executeOnFailure?: boolean;
}

export type SourceConfiguration = Partial<{
    id: `pipeline_source:${string}`
    label: string
    description: string
    targetPath: string
    type: "git" | "svn" | "tfs"

    branch: string
    username: string
    password: string
    cloneDepth: number

    lastHash: string,

    pollingBehavior: string
    pollForUpdates: boolean,

    denyList: string
    invertFilter: boolean

    url: string
    pipelines: PipelineDefinition[]
}>


export type PipelineDefinition = {
    id: `pipeline:${string}`
    label: string
    description: string
    labelTemplate: string
    state: "locked" | "paused" | "active"
    lockingBehavior: "singleton" | "singletonNoFail" | "multiple"
    group: string
    isTemplate: boolean
    kind: "build" | "release"

    // record id for the pipeline's template
    pipelineTemplate: string,
    // If the pipeline is a clone so a user can edit and save
    // it all at once
    isUserEditInstance: boolean,
    automaticScheduling: boolean

    cronSchedule: string
    cronRunOnlyOnNewSource: boolean

    trackingToolPattern: string
    trackingToolUri: string

    order: number
    stages?: StageDefinition[]
    environment?: EnvironmentVariable[]
    sources?: SourceConfiguration[],
    history?: HistoryObject[]

    lastScheduledEpoch?: number,
    lastScheduledBy?: string

    stats?: {
        runCount: number,
        successCount: number,
        failCount: number,

        // ms
        totalRuntime: number
    }
}

export type PipelineInstance = {
    id: `pipeline_instance:${string}`,
    identifier: string,
    spec: PipelineDefinition,
    metadata: unknown,
    status: {
        phase: "started" | "running" | "stopped" | "waiting" | "failed",
        startEpoch: number,
        jobInstances: string[]
        endEpoch?: number,
        stageApprovals?: {
            stageId: string,
            approvalCount: number,
            readyForApproval: boolean,
            approvers: string[],
            hasRun: boolean
        }[]
    },
    stats: {
        successfulTaskCount: number;
        failedTaskCount: number;
        totalRuntime: number;
    }
}
