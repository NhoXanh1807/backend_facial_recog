import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { User } from '../user/user.schema';
import { CreateUserDto } from '../user/dto/create-user.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  // Change to use employeeId instead of username
  async validateUser(employeeId: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmployeeId(employeeId); // Use findOneByEmployeeId method
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { 
      employeeId: user.employeeId, // Use employeeId instead of username
      sub: user._id,
      role: user.role
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(user: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const createdUser = await this.userService.create({
      ...user,
      password: hashedPassword,
      role: user.role as 'hr' | 'employee', // 👈 Cast role to avoid TS2345 error
    });
    const { password, ...result } = createdUser;
    return result;
  }
}
