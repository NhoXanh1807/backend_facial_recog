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
interface WorkDayLog {
  date: string;
  clockIn: string;
  clockOut: string;
  workHours: number;
  completed: boolean;
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

  async getWorkStats(startDate: Date, endDate: Date, employeeId?: string): Promise<WorkStatsResult[]> {
    if (!this.connection?.db) return [];
  
    // ====================
    // 1. Lấy tổng hợp từ log_
    // ====================
    const collections = await this.connection.db.listCollections().toArray();
    const logCollections = collections
      .map(col => col.name)
      .filter(name => name.startsWith('log_'));
  
    const filteredLogCollections = logCollections.filter(name => {
      const parts = name.split('_');
      if (parts.length !== 4) return false;
      const dd = parts[1];
      const mm = parts[2];
      const yyyy = parts[3];
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      return date >= startDate && date <= endDate;
    });
  
    const statsMap = new Map<string, {
      name: string;
      daysWorked: number;
      totalWorkHours: number;
      logHistory: WorkDayLog[];
    }>();
  
    for (const name of filteredLogCollections) {
      const parts = name.split('_');
      const dateStr = `${parts[3]}-${parts[2]}-${parts[1]}`;
      const collection = this.connection.db.collection(name);
      const logs = await collection.find().toArray();
  
      for (const log of logs) {
        const employerId = String(log['Employer ID']);
        if (employeeId && employerId !== employeeId) continue;
  
        if (!statsMap.has(employerId)) {
          statsMap.set(employerId, {
            name: log.Name || '',
            daysWorked: 0,
            totalWorkHours: 0,
            logHistory: [],
          });
        }
  
        const stat = statsMap.get(employerId)!;
  
        const hours = Number(log.WorkHours);
        if (!isNaN(hours)) stat.totalWorkHours += hours;
        if (log.Completed) stat.daysWorked += 1;
      }
    }
  
    // ==============================
    // 2. Lấy lịch sử từ raw_log_
    // ==============================
    const rawCollections = collections
      .map(col => col.name)
      .filter(name => name.startsWith('raw_log_'));
  
    const filteredRawCollections = rawCollections.filter(name => {
      const parts = name.split('_');
      if (parts.length !== 5) return false;
      const dd = parts[2];
      const mm = parts[3];
      const yyyy = parts[4];
      const date = new Date(`${yyyy}-${mm}-${dd}`);
      return date >= startDate && date <= endDate;
    });
  
    for (const name of filteredRawCollections) {
      const parts = name.split('_');
      const dateStr = `${parts[4]}-${parts[3]}-${parts[2]}`;
      const collection = this.connection.db.collection(name);
      const logs = await collection.find().toArray();
  
      for (const log of logs) {
        const employerId = String(log['Employer ID']);
        if (employeeId && employerId !== employeeId) continue;
  
        if (!statsMap.has(employerId)) {
          statsMap.set(employerId, {
            name: log.Name || '',
            daysWorked: 0,
            totalWorkHours: 0,
            logHistory: [],
          });
        }
  
        const stat = statsMap.get(employerId)!;
        const clockIn = log['Clock In'] || '';
        const clockOut = log['Clock Out'] || '';
        const workHours = this.calculateWorkHours(clockIn, clockOut);
        const completed = workHours >= 8;
  
        stat.logHistory.push({
          date: dateStr,
          clockIn,
          clockOut,
          workHours,
          completed,
        });
      }
    }
  
    return Array.from(statsMap.entries()).map(([id, data]) => ({
      employeeId: id,
      name: data.name,
      daysWorked: data.daysWorked,
      totalWorkHours: data.totalWorkHours,
      logHistory: data.logHistory,
    }));
  }
  
  
  
}