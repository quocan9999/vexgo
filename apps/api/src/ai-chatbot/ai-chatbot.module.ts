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

@Module({
  imports: [
    PrismaModule,
    TripsModule,
    TicketsModule,
    ShipmentsModule,
    PromotionsModule,
    LocationsModule,
  ],
  controllers: [AiChatbotController],
  providers: [
    EmbeddingProviderService,
    TextChunkerService,
    HybridRetrievalService,
    AiBusinessToolsService,
    AiChatbotOrchestratorService,
    AiChatbotService,
  ],
  exports: [
    AiChatbotService,
    AiChatbotOrchestratorService,
    HybridRetrievalService,
    EmbeddingProviderService,
  ],
})
export class AiChatbotModule {}
