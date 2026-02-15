interface Env {
    DB: D1Database;
    KV_STORE: KVNamespace;
    ASSETS_BUCKET: R2Bucket;
    EXECUTION_QUEUE: Queue;
    AI: any;
    JWT_SECRET: string;
    EXECUTION_COORDINATOR: DurableObjectNamespace;
}
