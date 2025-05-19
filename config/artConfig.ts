// config/artConfig.ts
import {
    ArtInstanceConfig,
    OllamaAdapter,
    LogLevel,
} from 'art-framework';

export const artConfig: ArtInstanceConfig = {
    storage: {
        type: 'indexedDB',
        dbName: 'InferenceQuotientBotDB_ART_NextJS',
        version: 1, // Corrected from dbVersion
    },
    providers: {
        availableProviders: [
            {
                name: 'ollama-qwen3-14b',
                adapter: OllamaAdapter,
                isLocal: true,
            }
        ],
        maxParallelApiInstancesPerProvider: 1,
        apiInstanceIdleTimeoutSeconds: 300,
    },
    tools: [],
    stateSavingStrategy: 'implicit',
    logger: {
        level: LogLevel.DEBUG,
    }
};