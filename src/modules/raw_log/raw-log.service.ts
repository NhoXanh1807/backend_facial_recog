// raw-log.service.ts
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { RawLogDocument } from './raw-log.schema';
import * as moment from 'moment';

interface WorkStatsResult {
  employeeId: string;
  name: string;
  daysWorked: number;
  totalWorkHours: number;
}

@Injectable()
export class RawLogService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async getAllCollections(): Promise<string[]> {
    if (!this.connection?.db) {
      return [];
    }
    const collections = await this.connection.db.listCollections().toArray();
    return collections
      .map((collection) => collection.name)
      .filter((name): name is string => name.startsWith('raw_log_'));
  }

  async getDataByDate(year: number, month: number, day: number): Promise<RawLogDocument[]> {
    const collectionName = `raw_log_${day.toString().padStart(2, '0')}_${month.toString().padStart(2, '0')}_${year}`;
    if (!this.connection?.db || !(await this.collectionExists(collectionName))) {
      return [];
    }
    const collection = this.connection.db.collection<RawLogDocument>(collectionName);
    return await collection.find().toArray();
  }

  private async collectionExists(collectionName: string): Promise<boolean> {
    if (!this.connection?.db) {
      return false;
    }
    const collections = await this.connection.db.listCollections({ name: collectionName }).toArray();
    return collections.length > 0;
  }

  async processAndSaveLogs(year: number, month: number, day: number): Promise<void> {
    const collectionName = `raw_log_${day.toString().padStart(2, '0')}_${month.toString().padStart(2, '0')}_${year}`;
    const targetCollectionName = `log_${day.toString().padStart(2, '0')}_${month.toString().padStart(2, '0')}_${year}`;

    if (!this.connection?.db || !(await this.collectionExists(collectionName))) {
      return;
    }

    const collection = this.connection.db.collection<RawLogDocument>(collectionName);
    const rawData = await collection.find().toArray();
    const targetCollection = this.connection.db.collection(targetCollectionName);

    const groupedData = new Map<string, {
      totalWorkHours: number;
      name: string;
      uploadDate: Date;
      sourceFile: string;
    }>();

    for (const log of rawData) {
      const { 'Clock In': clockIn, 'Clock Out': clockOut, 'Employer ID': employerIdRaw, Name, upload_date, source_file } = log;
      const employerId = String(employerIdRaw);
      const workHours = this.calculateWorkHours(clockIn, clockOut);

      if (!groupedData.has(employerId)) {
        groupedData.set(employerId, {
          totalWorkHours: 0,
          name: Name,
          uploadDate: new Date(upload_date),
          sourceFile: source_file,
        });
      }
      const existing = groupedData.get(employerId);
      if (existing) {
        existing.totalWorkHours += workHours;
      }
    }

    await targetCollection.deleteMany({});

    for (const [employerId, data] of groupedData.entries()) {
      const finalWorkHours = Math.min(data.totalWorkHours, 10);
      const completed = finalWorkHours >= 8;

      await targetCollection.insertOne({
        'Employer ID': employerId,
        Name: data.name,
        WorkHours: finalWorkHours,
        Completed: completed,
        UploadDate: data.uploadDate,
        SourceFile: data.sourceFile,
      });
    }
  }

  private calculateWorkHours(clockIn: string, clockOut: string): number {
    const clockInTime = moment(clockIn, 'HH:mm:ss');
    const clockOutTime = moment(clockOut, 'HH:mm:ss');
    const duration = moment.duration(clockOutTime.diff(clockInTime));
    return duration.asHours();
  }

  async getWorkStats(startDate: Date, endDate: Date, employeeId?: string) {
    if (!this.connection?.db) {
      return [];
    }

    const collections = await this.getAllCollections();
    const filteredCollections = collections.filter((name) => {
      const [_, dd, mm, yyyy] = name.split('_');
      const collectionDate = new Date(`${yyyy}-${mm}-${dd}`);
      return collectionDate >= startDate && collectionDate <= endDate;
    });

    const statsMap = new Map<string, {
      name: string;
      daysWorked: number;
      totalWorkHours: number;
    }>();

    for (const collectionName of filteredCollections) {
      const collection = this.connection.db.collection(collectionName);
      const logs = await collection.find().toArray();

      for (const log of logs) {
        const employerId = String(log['Employer ID']);
        if (employeeId && employerId !== employeeId) {
          continue;
        }

        if (!statsMap.has(employerId)) {
          statsMap.set(employerId, {
            name: log.Name || '',
            daysWorked: 0,
            totalWorkHours: 0,
          });
        }

        const stat = statsMap.get(employerId);
        if (stat) {
          if (log.Completed) {
            stat.daysWorked += 1;
          }
          stat.totalWorkHours += log.WorkHours;
        }
      }
    }

    const result: WorkStatsResult[] = [];
    for (const [id, data] of statsMap.entries()) {
      result.push({
        employeeId: id,
        name: data.name,
        daysWorked: data.daysWorked,
        totalWorkHours: data.totalWorkHours,
      });
    }

    return result;
  }
}