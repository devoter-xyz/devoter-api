import { prisma } from "../lib/prisma.js";
import { ApiError, HttpStatusCode } from "../utils/errorHandler.js";

interface UsageQueryOptions {
  apiKeyId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

interface UsageExportOptions {
  apiKeyId: string;
  format: 'csv' | 'json';
  startDate?: Date;
  endDate?: Date;
}

export async function getApiKeyUsageStatistics(options: UsageQueryOptions) {
  const { apiKeyId, startDate, endDate } = options;

  const whereClause: any = {
    apiKeyId: apiKeyId,
  };

  if (startDate && endDate) {
    whereClause.timestamp = {
      gte: startDate,
      lte: endDate,
    };
  } else if (startDate) {
    whereClause.timestamp = {
      gte: startDate,
    };
  } else if (endDate) {
    whereClause.timestamp = {
      lte: endDate,
    };
  }

  const totalRequests = await prisma.apiKeyUsage.count({
    where: whereClause,
  });

  const usageByEndpoint = await prisma.apiKeyUsage.groupBy({
    by: ['endpoint'],
    where: whereClause,
    _count: {
      id: true,
    },
    _avg: {
      responseTime: true,
    },
    _sum: {
      responseTime: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  const usageByStatusCode = await prisma.apiKeyUsage.groupBy({
    by: ['statusCode'],
    where: whereClause,
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  const averageResponseTime = await prisma.apiKeyUsage.aggregate({
    where: whereClause,
    _avg: {
      responseTime: true,
    },
  });

  return {
    totalRequests,
    usageByEndpoint: usageByEndpoint.map(item => ({
      endpoint: item.endpoint,
      count: item._count.id,
      averageResponseTime: item._avg.responseTime,
      totalResponseTime: item._sum.responseTime,
    })),
    usageByStatusCode: usageByStatusCode.map(item => ({
      statusCode: item.statusCode,
      count: item._count.id,
    })),
    overallAverageResponseTime: averageResponseTime._avg.responseTime,
  };
}

export async function getApiKeyUsageData(options: UsageQueryOptions) {
  const { apiKeyId, startDate, endDate, limit = 100, offset = 0 } = options;

  const whereClause: any = {
    apiKeyId: apiKeyId,
  };

  if (startDate && endDate) {
    whereClause.timestamp = {
      gte: startDate,
      lte: endDate,
    };
  } else if (startDate) {
    whereClause.timestamp = {
      gte: startDate,
    };
  } else if (endDate) {
    whereClause.timestamp = {
      lte: endDate,
    };
  }

  const usageRecords = await prisma.apiKeyUsage.findMany({
    where: whereClause,
    orderBy: {
      timestamp: 'desc',
    },
    take: limit,
    skip: offset,
  });

  const totalRecords = await prisma.apiKeyUsage.count({
    where: whereClause,
  });

  return { records: usageRecords, total: totalRecords };
}

export async function exportApiKeyUsageData(options: UsageExportOptions): Promise<string | object> {
  const { apiKeyId, format, startDate, endDate } = options;

  const whereClause: any = {
    apiKeyId: apiKeyId,
  };

  if (startDate && endDate) {
    whereClause.timestamp = {
      gte: startDate,
      lte: endDate,
    };
  } else if (startDate) {
    whereClause.timestamp = {
      gte: startDate,
    };
  } else if (endDate) {
    whereClause.timestamp = {
      lte: endDate,
    };
  }

  const usageRecords = await prisma.apiKeyUsage.findMany({
    where: whereClause,
    orderBy: {
      timestamp: 'desc',
    },
  });

  if (format === 'json') {
    return usageRecords;
  } else if (format === 'csv') {
    if (usageRecords.length === 0) {
      return "";
    }

    const headers = Object.keys(usageRecords[0]).join(',');
    const rows = usageRecords.map(record =>
      Object.values(record).map(value => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Handle potential commas in string values by quoting them
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.split('"').join('""')}"`;
        }
        return value;
      })).join(',');

    return [headers, ...rows].join('\n');
  } else {
    throw new ApiError(HttpStatusCode.BAD_REQUEST, 'Invalid export format specified.', 'INVALID_EXPORT_FORMAT');
  }
}
