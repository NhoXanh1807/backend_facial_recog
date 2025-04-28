export class CreateUserDto {
    username: string;
    password: string;
    role: 'hr' | 'employee';
    employeeId: string;
  }