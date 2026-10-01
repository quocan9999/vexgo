import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { RequireRoles } from '../auth/decorators/require-roles.decorator.js';
import { ContactsService } from './contacts.service.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { ContactQueryDto } from './dto/contact-query.dto.js';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto.js';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() body: CreateContactDto) {
    return this.contactsService.create(body);
  }

  @Get()
  @RequireRoles('SUPER_ADMIN')
  findAll(@Query() query: ContactQueryDto) {
    return this.contactsService.findAll(query);
  }

  @Get(':id')
  @RequireRoles('SUPER_ADMIN')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.findOne(id);
  }

  @Patch(':id/status')
  @RequireRoles('SUPER_ADMIN')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateContactStatusDto,
  ) {
    return this.contactsService.updateStatus(id, body.status);
  }
}
