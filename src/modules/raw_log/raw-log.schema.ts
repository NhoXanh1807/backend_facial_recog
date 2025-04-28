import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RawLogDocument = RawLog & Document;

@Schema({ strict: false })
export class RawLog {
  @Prop()
  'Employer ID': number;

  @Prop()
  Name: string;

  @Prop()
  'Clock In': string;

  @Prop()
  'Clock Out': string;

  @Prop()
  upload_date: string;

  @Prop()
  source_file: string;
}

export const RawLogSchema = SchemaFactory.createForClass(RawLog);