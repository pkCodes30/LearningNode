import { Test, type TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/**
 * UNIT test of the controller: here we mock one layer down (UsersService), so no Prisma is involved.
 *
 * Kept small on purpose. The controller only passes values along, and the things that make it real
 * (routes, ParseIntPipe, status codes) only run over HTTP, so test/users.e2e-spec.ts covers those.
 */
describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findOne: vi.fn(),
    remove: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    }).compile();

    controller = module.get(UsersController);
  });

  it('findOne returns what the service returns', async () => {
    const asha = { id: 1, email: 'asha@shop.dev' };
    usersServiceMock.findOne.mockResolvedValue(asha);

    await expect(controller.findOne(1)).resolves.toEqual(asha);
    expect(usersServiceMock.findOne).toHaveBeenCalledWith(1);
  });

  it('remove returns nothing (the 204 itself is checked in the e2e tests)', async () => {
    usersServiceMock.remove.mockResolvedValue(undefined);

    await expect(controller.remove(1)).resolves.toBeUndefined();
    expect(usersServiceMock.remove).toHaveBeenCalledWith(1);
  });
});
