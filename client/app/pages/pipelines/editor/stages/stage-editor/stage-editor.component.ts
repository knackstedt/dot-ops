import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Component, EventEmitter, Inject, Input, Optional } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { Fetch, MenuDirective, MenuItem } from '@dotglitch/ngx-common';
import { ulid } from 'ulidx';
import { JobDefinition, PipelineDefinition, StageDefinition, TaskDefinition, TaskGroupDefinition } from 'types/pipeline';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { FormioWrapperComponent } from 'client/app/components/formio-wrapper/formio-wrapper.component';
import { Schemas, DefaultSchema } from './task-schemas';
import { StackEditorComponent } from 'ngx-stackedit';
import { FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { PipelineEditorComponent } from 'client/app/pages/pipelines/editor/editor.component';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FileUploadService } from 'client/app/services/file-upload.service';
import { VariablesSectionComponent } from 'client/app/components/variables-section/variables-section.component';
import { ArtifactsSectionComponent } from 'client/app/components/artifacts-section/artifacts-section.component';

@Component({
    selector: 'app-stage-editor',
    standalone: true,
    imports: [
        MatExpansionModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatTabsModule,
        MatTooltipModule,
        FormsModule,
        DragDropModule,
        NgScrollbarModule,
        FormioWrapperComponent,
        StackEditorComponent,
        MenuDirective,
        VariablesSectionComponent,
        ArtifactsSectionComponent
    ],
    templateUrl: './stage-editor.component.html',
    styleUrl: './stage-editor.component.scss'
})
export class StageEditorComponent {

    readonly defaultContainerImage = "ghcr.io/knackstedt/cruiser/cruiser-agent:latest";

    @Input() pipeline: PipelineDefinition = {} as any;
    @Input() stage: StageDefinition = {} as any;

    selectedJob: JobDefinition;
    selectedTaskGroup: TaskGroupDefinition;
    selectedTask: TaskDefinition;
    selectedTaskSchema: Object;

    currentSelection: "pipeline" | "stage" | "job" | "taskGroup" | "task" = 'task';

    jobMenu: MenuItem<JobDefinition>[] = [
        { label: "Enable Job", action: item => this.enableJob(item), isVisible: item => item.disabled },
        { label: "Disable Job", action: item => this.disableJob(item), isVisible: item => !item.disabled },
        { label: "Delete Job", action: item => this.deleteJob(item) }
    ];
    taskGroupMenu: MenuItem<{ job: JobDefinition, taskGroup: TaskGroupDefinition}>[] = [
        { label: "Enable Task Group", action: item => this.enableTaskGroup(item.job, item.taskGroup), isVisible: item => item.taskGroup.disabled },
        { label: "Disable Task Group", action: item => this.disableTaskGroup(item.job, item.taskGroup), isVisible: item => !item.taskGroup.disabled },
        { label: "Delete Task Group", action: item => this.deleteTaskGroup(item.job, item.taskGroup) }
    ];
    taskMenu: MenuItem<{ taskGroup: TaskGroupDefinition, task: TaskDefinition}>[] = [
        { label: "Enable Task", action: item => this.enableTask(item.taskGroup, item.task), isVisible: item => item.task.disabled },
        { label: "Disable Task", action: item => this.disableTask(item.taskGroup, item.task), isVisible: item => !item.task.disabled },
        { label: "Delete Task", action: item => this.deleteTask(item.taskGroup, item.task) },
        { label: "Clone Task", action: item => this.cloneTask(item.taskGroup, item.task) }
    ];

    dataChangeEmitter = new Subject();
    dataChange$ = this.dataChangeEmitter.pipe(debounceTime(500));

    subscriptions = [
        // Save partial changes every 3s
        this.dataChange$.subscribe(() => {
            this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
                stages: this.pipeline.stages
            });
        })
    ]

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) private readonly data,
        private readonly fetch: Fetch,
        public  readonly fs: FileUploadService
    ) {
        this.pipeline = data?.pipeline;
        this.stage = data?.stage;
    }

    ngOnInit() {
        if (!this.stage) return;

        this.stage.jobs = this.stage.jobs ?? [];

        // Attempt to auto pick the first task.
        this.selectTask(this.stage.jobs?.[0]?.taskGroups?.[0]?.tasks?.[0])
    }

    ngOnDestroy() {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    private patchPipeline() {
        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
    }

    async addJob() {
        this.stage.jobs = this.stage.jobs ?? [];
        const job = {
            id: "pipeline_job:" + ulid(),
            label: 'Job - ' + (this.stage.jobs.length + 1),
            order: this.stage.jobs.length + 1,
            taskGroups: [
                {
                    id: `pipeline_task_group:${ulid()}`,
                    label: "Task Group 1",
                    order: 0,
                    tasks: []
                }
            ]
        } as JobDefinition;

        this.stage.jobs.push(job);

        this.fetch.patch(`/api/odata/${this.pipeline.id}`, {
            stages: this.pipeline.stages
        });
        this.selectJob(job);
    }

    async deleteJob(job: JobDefinition) {
        this.stage.jobs = this.stage.jobs.filter(j => j != job);
        this.patchPipeline();
    }
    async disableJob(job: JobDefinition) {
        job.disabled = true;
        this.patchPipeline();
    }
    async enableJob(job: JobDefinition) {
        job.disabled = false;
        this.patchPipeline();
    }

    async addTaskGroup(job: JobDefinition) {
        job.taskGroups = job.taskGroups ?? [];

        const taskGroup = {
            id: "pipeline_task_group:" + ulid(),
            label: 'Task Group - ' + (job.taskGroups.length + 1),
            order: job.taskGroups.length + 1,
            tasks: []
        } as TaskGroupDefinition;

        job.taskGroups.push(taskGroup);

        this.patchPipeline();
        this.selectTaskGroup(taskGroup);
    }

    async deleteTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        job.taskGroups = job.taskGroups.filter(tg => tg != taskGroup);
        this.patchPipeline();
    }
    async disableTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        taskGroup.disabled = true;

        this.patchPipeline();
    }
    async enableTaskGroup(job: JobDefinition, taskGroup: TaskGroupDefinition) {
        taskGroup.disabled = true;

        this.patchPipeline();
    }

    addTask(taskGroup: TaskGroupDefinition) {
        taskGroup.tasks = taskGroup.tasks ?? [];

        const task = {
            id: "pipeline_task:" + ulid(),
            label: 'Task - ' + (taskGroup.tasks.length + 1),
            order: taskGroup.tasks.length + 1,
            taskScriptArguments: {}
        } as TaskDefinition;

        taskGroup.tasks.push(task);

        this.patchPipeline();
        this.selectTask(task);
    }

    async deleteTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks = taskGroup.tasks.filter(t => t != task);

        this.patchPipeline();
    }
    async disableTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        task.disabled = true;

        this.patchPipeline();
    }
    async enableTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        task.disabled = false;

        this.patchPipeline();
    }
    async cloneTask(taskGroup: TaskGroupDefinition, task: TaskDefinition) {
        taskGroup.tasks.push(structuredClone(task));

        this.patchPipeline();
    }

    async taskDrop(taskGroup: TaskGroupDefinition, event: CdkDragDrop<any, any, any>) {
        // Simple reordering
        if (event.previousContainer === event.container) {
            if (event.previousIndex == event.currentIndex) return;

            // Update the array position after the data is updated in the backend
            moveItemInArray(taskGroup.tasks, event.previousIndex, event.currentIndex);

            taskGroup.tasks.forEach((item, index) => {
                item.order = index;
            });

            // Update the order of all of the items
            // this.fetch.patch(`/api/odata`, taskGroup.tasks.map(i => ({ id: i.id, data: { order: i.order } })));
        }
        // Item moved to a new parent
        else {
            // This is equally terrible and amazing. Please arrest me.
            const objects = [
                this.pipeline,
                ...this.pipeline.stages,
                ...this.pipeline.stages.map(s => s.jobs),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups).flat()),
                ...this.pipeline.stages.map(s => s.jobs.map(j => j.taskGroups.map(g => g.tasks).flat()).flat()),
            ].flat();


            const [kind, id] = event.previousContainer.data.split(':');

            let subKey = '';

            // This will only run for things _below_ a pipeline. Do not worry about stages.
            if (kind == "pipeline_stage") {
                subKey = 'jobs';
            }
            else if (kind == "pipeline_job") {
                subKey = 'taskGroups';
            }
            else if (kind == "pipeline_task_group") {
                subKey = 'tasks';
            }

            const originalParent = objects.find(o => o.id == event.previousContainer.data);
            const targetParent = objects.find(o => o.id == event.container.data);

            const oArr = originalParent[subKey];
            const tArr = targetParent[subKey];

            transferArrayItem(
                oArr,
                tArr,
                event.previousIndex,
                event.currentIndex,
            );

            // this.items.map(i => ({ id: i.id, data: { order: i.order } }))
            // Update the order of all of the items
            // this.fetch.patch(`/api/odata`, [
            //     { id: event.previousContainer.data, data: { [subKey]: oArr.map(t => t.id) } },
            //     { id: event.container.data, data: { [subKey]: tArr.map(t => t.id) } }
            // ]);
        }
        this.patchPipeline();
    }

    selectJob(job: JobDefinition) {
        this.selectedJob = job;
        this.currentSelection = 'job';
    }

    selectTaskGroup(taskGroup: TaskGroupDefinition) {
        this.selectedTaskGroup = taskGroup;
        this.currentSelection = 'taskGroup';
    }

    selectTask(task: TaskDefinition) {
        if (!task) return;
        // Ensure that the task has the proper argument object
        if (!task.taskScriptArguments) task.taskScriptArguments = {};

        this.selectedTask = task;
        this.selectedTaskSchema = Schemas.find(s => s.kind == task.taskScriptId) || DefaultSchema;
        this.currentSelection = 'task';
    }
}
