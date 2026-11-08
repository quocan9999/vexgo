import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { TripsModule } from '../trips/trips.module.js';
import { TicketsModule } from '../tickets/tickets.module.js';
import { ShipmentsModule } from '../shipments/shipments.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { LocationsModule } from '../locations/locations.module.js';
import { AiChatbotController } from './ai-chatbot.controller.js';
import { AiChatbotService } from './ai-chatbot.service.js';
import { EmbeddingProviderService } from './embedding/embedding-provider.service.js';
import { TextChunkerService } from './chunking/text-chunker.service.js';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service.js';
import { AiBusinessToolsService } from './tools/ai-business-tools.service.js';
import { AiChatbotOrchestratorService } from './orchestrator/ai-chatbot-orchestrator.service.js';
import { AiKnowledgeAdminController } from './admin/ai-knowledge-admin.controller.js';
import { AiKnowledgeAdminService } from './admin/ai-knowledge-admin.service.js';
import { AiChatbotSettingsController } from './admin/ai-chatbot-settings.controller.js';
import { AiChatbotSettingsService } from './admin/ai-chatbot-settings.service.js';

@Module({
  imports: [
    PrismaModule,
    TripsModule,
    TicketsModule,
    ShipmentsModule,
    PromotionsModule,
    LocationsModule,
  ],
  controllers: [
    AiChatbotController,
    AiKnowledgeAdminController,
    AiChatbotSettingsController,
  ],
  providers: [
    EmbeddingProviderService,
    TextChunkerService,
    HybridRetrievalService,
    AiBusinessToolsService,
    AiChatbotOrchestratorService,
    AiChatbotService,
    AiKnowledgeAdminService,
    AiChatbotSettingsService,
  ],
  exports: [
    AiChatbotService,
    AiChatbotOrchestratorService,
    HybridRetrievalService,
    EmbeddingProviderService,
    AiKnowledgeAdminService,
    AiChatbotSettingsService,
  ],
})
export class AiChatbotModule {}
