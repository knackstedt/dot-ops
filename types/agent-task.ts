import { JobDefinition, PipelineDefinition } from './pipeline';

export type JobInstance = {
    id: string
    label: string
    state:
        "pending"       | // Pending provisioning of job container
        "initializing"  | // Job is just starting up
        "cloning"       | // Job is downloading source
        "building"      | // Job is actively running build code
        "frozen"        | // Job (task group) is frozen
        "sealing"       | // Job is compressing
        "completed"     | // Job is finished and acknowledged by scheduler
        "failed"
    job: JobDefinition,
    pipeline: PipelineDefinition,
    kubeNamespace: string
    kubePodName: string

    queueEpoch: number
    initEpoch: number
    cloneEpoch: number
    buildEpoch: number
    uploadEpoch: number
    endEpoch: number

    errorCount: number
    warnCount: number
};


export type ElasticAgentConfig = {
    id: string;
    label: string;
    kubeNamespace: string;
    kubeContainerImage: string;
    errorCount: number;
    warnCount: number;
};

export type ElasticAgent = {

}

export type StaticAgentConfig = {

}

export type StaticAgent = {

}
