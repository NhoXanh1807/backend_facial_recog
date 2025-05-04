// user.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findOne(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).lean().exec();
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    return this.userModel.findOne({ employeeId }).lean().exec();
  }

  async getAllUsers(): Promise<User[]> {
    return this.userModel.find().select('-password').exec();
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userModel.findById(id).select('-password').exec();
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel(data);
    return createdUser.save();
  }



  async deleteUser(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
  }
}