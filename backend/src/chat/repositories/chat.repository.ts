import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  //   async findOrdCreate
}

export default ChatRepository;
