
REMOVE TABLE pipelineTaskGroup;
DEFINE TABLE pipelineTaskGroup SCHEMALESS;
    /**
     * General
     */
    DEFINE FIELD label ON TABLE pipelineTaskGroup TYPE string
        ASSERT $value != NONE;
    DEFINE FIELD description ON TABLE pipelineTaskGroup TYPE any;
    DEFINE FIELD `order` ON TABLE pipelineTaskGroup TYPE int
        ASSERT $value != NONE
        VALUE $value OR 0;

    /**
     * Relations
     */
    -- A task to run when this task fails or is cancelled
    DEFINE FIELD environment ON TABLE pipelineTaskGroup TYPE any;
    DEFINE FIELD environment.* ON TABLE pipelineTaskGroup TYPE any
        ASSERT $value != NONE AND $value != null;
    DEFINE FIELD tasks ON TABLE pipelineTaskGroup TYPE array;
    DEFINE FIELD tasks.* ON TABLE pipelineTaskGroup TYPE any
        ASSERT $value != NONE AND $value != null;
