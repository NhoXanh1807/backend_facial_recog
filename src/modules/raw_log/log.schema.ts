// log.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Log extends Document {
  @Prop({ required: true })
  employeeId: string;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true })
  totalDuration: number; // tổng thời gian làm việc sau khi cộng dồn (giờ)

  @Prop({ default: false })
  completed: boolean;
}

export const LogSchema = SchemaFactory.createForClass(Log);