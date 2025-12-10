import {
  createUserSchema,
  type CreateUserInput,
  updateUserSchema,
  type UpdateUserInput,
} from "./model";
import { userRepository } from "./repository";

export const userApplication = {
  listUsers: () => userRepository.findAll(),

  registerUser: async (input: CreateUserInput) => {
    const payload = createUserSchema.parse(input);
    const existing = await userRepository.findByEmail(payload.email);
    if (existing) {
      throw new Error("USER_EMAIL_EXISTS");
    }

    return userRepository.create({
      email: payload.email,
      name: payload.name,
      phone: payload.phone,
      birthDate: payload.birthDate,
    });
  },

  updateUser: async (input: UpdateUserInput) => {
    const payload = updateUserSchema.parse(input);
    return userRepository.update(payload.id, {
      name: payload.name,
      phone: payload.phone,
      birthDate: payload.birthDate,
    });
  },
};
