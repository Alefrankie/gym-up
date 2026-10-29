<script lang="ts">
  import { Chart, registerables } from 'chart.js';
  import { onDestroy } from 'svelte';

  Chart.register(...registerables);

  interface Props {
    labels: string[];
    values: number[];
    label: string;
  }

  let { labels, values, label }: Props = $props();

  let canvas: HTMLCanvasElement | undefined = $state();
  let chart: Chart | undefined;

  // Chart.js is used directly (ADR-027, replacing the React island of ADR-002): create once, then update in place.
  $effect(() => {
    if (!canvas) return;
    if (!chart) {
      chart = new Chart(canvas, {
        type: 'line',
        data: { labels: [...labels], datasets: [{ label, data: [...values], borderColor: '#22c55e', backgroundColor: '#22c55e33', fill: true, tension: 0.25, pointRadius: 3 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#94a3b8', maxTicksLimit: 6 }, grid: { color: '#1e293b' } },
            y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' }, beginAtZero: true },
          },
        },
      });
      return;
    }
    chart.data.labels = [...labels];
    chart.data.datasets[0]!.data = [...values];
    chart.data.datasets[0]!.label = label;
    chart.update();
  });

  onDestroy(() => chart?.destroy());
</script>

<div class="chart"><canvas bind:this={canvas} aria-label={label}></canvas></div>

<style>
  .chart {
    position: relative;
    height: 14rem;
  }
</style>
