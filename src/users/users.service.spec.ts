import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

/**
 * UNIT test: UsersService alone, with NO database. Each test finishes in about a millisecond.
 *
 * We swap the real PrismaService for a mock, so a test can decide what "the database" answers,
 * and can check what the service asked it to do. See notes/11-testing.md.
 */
describe('UsersService', () => {
  let service: UsersService;

  // A MOCK: an object with the same shape as the Prisma calls the service uses. Each `vi.fn()` is a
  // fake function that records its calls and returns whatever a test tells it to.
  const prismaMock = {
    user: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  // A row, as the database would return it.
  const asha = {
    id: 1,
    email: 'asha@shop.dev',
    name: 'Asha',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    // Forget the calls and answers from the previous test, so tests can't affect each other.
    vi.resetAllMocks();

    // A mini Nest app with only what we list. `useValue` (notes/10 §2) is the swap:
    // "when UsersService asks for PrismaService, give it prismaMock".
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findOne', () => {
    it('returns the user when the database finds one', async () => {
      // ARRANGE: decide what "the database" answers. `mockResolvedValue` = return a resolved promise.
      prismaMock.user.findUnique.mockResolvedValue(asha);

      // ACT: call the real method.
      const result = await service.findOne(1);

      // ASSERT: check the result, and that the service asked for the right row.
      expect(result).toEqual(asha);
      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('throws NotFoundException when the database finds nothing', async () => {
      // findUnique gives `null` for a missing row. This is the one real decision in this service,
      // so it's the most valuable test in this file.
      prismaMock.user.findUnique.mockResolvedValue(null);

      // `.rejects` waits for the promise and checks how it failed.
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(99)).rejects.toThrow('User 99 not found');
    });
  });

  describe('create', () => {
    it('saves the DTO and returns the saved row', async () => {
      prismaMock.user.create.mockResolvedValue(asha);
      const dto = { email: 'asha@shop.dev', name: 'Asha' };

      await expect(service.create(dto)).resolves.toEqual(asha);
      expect(prismaMock.user.create).toHaveBeenCalledWith({ data: dto });
    });

    it('lets a database error through, so the exception filter can answer', async () => {
      // `mockRejectedValue` = return a rejected promise: "the database failed".
      const dbError = new Error('duplicate email');
      prismaMock.user.create.mockRejectedValue(dbError);

      // The service must not swallow the error. Turning it into a 409 is the filter's job,
      // and that part is proved by the e2e tests, because a mock can't produce a real P2002.
      await expect(service.create({ email: 'a@b.com' })).rejects.toBe(dbError);
    });
  });

  describe('findAll', () => {
    it('asks for the users ordered by id', async () => {
      prismaMock.user.findMany.mockResolvedValue([asha]);

      await expect(service.findAll()).resolves.toEqual([asha]);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith({
        orderBy: { id: 'asc' },
      });
    });
  });

  describe('remove', () => {
    it('deletes the row and returns nothing', async () => {
      prismaMock.user.delete.mockResolvedValue(asha);

      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('update', () => {
    // ✍️ YOUR DRILL (notes/11 §9): replace this line with a real test. It shows as "todo" until then.
    it.todo('passes the id and the DTO to prisma.user.update');
  });
});
