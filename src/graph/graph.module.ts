import { Module } from '@nestjs/common';
import { GRAPH_CLIENT } from './graph-client.interface';
import { LiveGraphClient } from './graph.client.live';
import { StubGraphClient } from './graph.client.stub';
import { TokenService } from './token.service.js';

@Module({
  providers: [
    TokenService,
    {
      provide: GRAPH_CLIENT,
      useClass:
        process.env.GRAPH_MODE === 'live' ? LiveGraphClient : StubGraphClient,
    },
  ],
  exports: [GRAPH_CLIENT],
})
export class GraphModule {}
