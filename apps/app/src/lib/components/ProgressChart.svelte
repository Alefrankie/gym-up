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

  const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Chart.js is used directly (ADR-027, replacing the React island of ADR-002): create once, then update in place.
  $effect(() => {
    if (!canvas) return;
    if (!chart) {
      const accent = css('--accent');
      const muted = css('--muted');
      const line = css('--line');
      chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: [...labels],
          datasets: [
            {
              label,
              data: [...values],
              borderColor: accent,
              borderWidth: 2,
              backgroundColor: 'rgb(255 106 43 / 0.08)',
              fill: true,
              tension: 0.3,
              pointRadius: 2.5,
              pointHoverRadius: 4,
              pointBackgroundColor: accent,
              pointBorderColor: css('--surface'),
              pointBorderWidth: 1.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: muted, maxTicksLimit: 6, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: muted, font: { size: 11 } }, grid: { color: line }, border: { display: false }, beginAtZero: true },
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
    height: 11rem;
  }
</style>
