import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StageEditorComponent } from 'client/app/pages/pipelines/editor/stages/stage-editor/stage-editor.component';
import { StageDefinition } from 'types/pipeline';

@Component({
    selector: 'app-stage-node',
    templateUrl: './stage-node.component.html',
    styleUrls: ['./stage-node.component.scss'],
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule
    ],
    standalone: true
})
export class StageNodeComponent {

    @Input('data') stage: StageDefinition;
    @Input() editing = true;

    @Output() onPrerequisiteClick = new EventEmitter();
    @Output() onJobsClick = new EventEmitter();
    @Output() onNodeClick = new EventEmitter();

    @Output() onSourceClick = new EventEmitter();
    @Output() onSourceEditClick = new EventEmitter();

    @Output() onScheduleClick = new EventEmitter();
    @Output() onScheduleEditClick = new EventEmitter();

    @Output() onTriggerClick = new EventEmitter();
    @Output() onTriggerEditClick = new EventEmitter();

    @Output() onManualRunClick = new EventEmitter();

    @Output() onApproverClick = new EventEmitter();
    @Output() onApproverEditClick = new EventEmitter();

    @Output() onWebhookEditClick = new EventEmitter();
    @Output() onWebhookClick = new EventEmitter();

    @Output() onStageAddClick = new EventEmitter();
    @Output() onStageCloneClick = new EventEmitter();

    taskCount = 0;

    constructor(
        private readonly matDialog: MatDialog
    ) { }

    ngOnInit() {
        this.stage.jobs.forEach(j =>
            j.taskGroups.forEach(tg =>
                this.taskCount += tg.tasks.length
            )
        )
    }

    ngAfterViewInit() {

    }

    editStage() {
        this.matDialog.open(StageEditorComponent, {
            data: {
                // pipeline: this.pipeline,
                stage: this.stage
            }
        })
    }
}