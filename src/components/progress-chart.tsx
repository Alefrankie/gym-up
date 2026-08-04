// src/components/progress-chart.tsx
//
// Story 3.2 — Progress Chart (React island per ADR-002).
// Receives already-converted data (page layer does kg → lbs per ADR-006).
// Renders <Line> for weight charts, <Bar> for volume charts.

import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

/**
 * One chart data point. Weight + volume are already in the user's
 * preferred unit (conversion happens at the page layer per ADR-006).
 */
export interface ChartDataPoint {
  date: string; // YYYY-MM-DD
  weight: number;
  volume: number;
}

export interface ProgressChartProps {
  exerciseId: string;
  exerciseName: string;
  data: ChartDataPoint[];
  type: 'weight' | 'volume';
  weightUnit: 'kg' | 'lbs';
}

export default function ProgressChart({
  exerciseId,
  exerciseName,
  data,
  type,
  weightUnit,
}: ProgressChartProps) {
  const isLine = type === 'weight';

  const chartData = useMemo(
    () => ({
      labels: data.map((p) => p.date),
      datasets: [
        {
          label: isLine ? `Peso (${weightUnit})` : `Volumen (${weightUnit})`,
          data: data.map((p) => (isLine ? p.weight : p.volume)),
          borderColor: '#ff4d4d',
          backgroundColor: isLine
            ? 'rgba(255, 77, 77, 0.1)'
            : 'rgba(255, 77, 77, 0.6)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#ff4d4d',
          fill: isLine,
          tension: 0.2,
        },
      ],
    }),
    [data, isLine, weightUnit],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: { color: 'rgba(255, 255, 255, 0.85)' },
        },
        title: {
          display: true,
          text: isLine
            ? `Peso — ${exerciseName}`
            : `Volumen — ${exerciseName}`,
          color: 'rgba(255, 255, 255, 0.95)',
          font: { size: 16, weight: 'bold' as const },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: '#ff4d4d',
          borderWidth: 1,
          padding: 10,
        },
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255, 255, 255, 0.7)' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
        y: {
          beginAtZero: false,
          ticks: { color: 'rgba(255, 255, 255, 0.7)' },
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
        },
      },
    }),
    [isLine, exerciseName],
  );

  return (
    <div
      className="progress-chart"
      data-exercise-id={exerciseId}
      data-type={type}
    >
      {isLine ? (
        <Line data={chartData} options={options} />
      ) : (
        <Bar data={chartData} options={options} />
      )}
    </div>
  );
}
