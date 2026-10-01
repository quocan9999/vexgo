import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateContactDto } from './dto/create-contact.dto.js';
import type { ContactQueryDto, ContactStatus } from './dto/contact-query.dto.js';

type LienHeRecord = Prisma.LienHeGetPayload<Record<string, never>>;

export interface ContactResponse {
  contactId: number;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactDto): Promise<ContactResponse> {
    const contact = await this.prisma.lienHe.create({
      data: {
        hoTen: dto.fullName,
        soDienThoai: dto.phoneNumber,
        email: dto.email || null,
        tieuDe: dto.subject,
        noiDung: dto.message,
        trangThai: 'CHO_XU_LY',
      },
    });

    return this.mapContact(contact);
  }

  async findAll(query: ContactQueryDto) {
    const where: Prisma.LienHeWhereInput = {};

    if (query.status) {
      where.trangThai = query.status;
    }

    if (query.search) {
      where.OR = [
        { hoTen: { contains: query.search } },
        { soDienThoai: { contains: query.search } },
        { email: { contains: query.search } },
        { tieuDe: { contains: query.search } },
      ];
    }

    const direction = query.sortDirection === 'desc' ? 'desc' : 'asc';
    const orderBy: Prisma.LienHeOrderByWithRelationInput = {
      [query.sortBy]: direction,
    };

    const [totalItems, items] = await Promise.all([
      this.prisma.lienHe.count({ where }),
      this.prisma.lienHe.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      data: items.map((item) => this.mapContact(item)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number): Promise<ContactResponse> {
    const contact = await this.prisma.lienHe.findUnique({
      where: { lienHeId: id },
    });

    if (!contact) {
      throw new NotFoundException({
        error: 'CONTACT_NOT_FOUND',
        message: 'Không tìm thấy yêu cầu liên hệ.',
      });
    }

    return this.mapContact(contact);
  }

  async updateStatus(id: number, status: ContactStatus): Promise<ContactResponse> {
    await this.findOne(id);

    const updated = await this.prisma.lienHe.update({
      where: { lienHeId: id },
      data: { trangThai: status },
    });

    return this.mapContact(updated);
  }

  private mapContact(contact: LienHeRecord): ContactResponse {
    return {
      contactId: contact.lienHeId,
      fullName: contact.hoTen,
      phoneNumber: contact.soDienThoai,
      email: contact.email,
      subject: contact.tieuDe,
      message: contact.noiDung,
      status: contact.trangThai,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }
}
