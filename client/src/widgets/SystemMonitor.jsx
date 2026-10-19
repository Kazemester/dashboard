import React from 'react';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';
import { Ring } from '../components/Charts.jsx';

const gb = (b) => (b == null ? '–' : `${(b / 1024 ** 3).toFixed(1)} GB`);
const up = (s) => {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d ? t('{d}n {h}ó', { d, h }) : t('{h}ó {m}p', { h, m });
};

export default function SystemMonitor({ widget }) {
  const { data, error } = useWidgetData('/system', { interval: Math.max(3, Number(widget.config.intervalSec) || 5) * 1000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('TELEMETRIA…')}</div>;
  const memUsed = data.mem.total - data.mem.available;
  const diskUsed = data.disk ? data.disk.total - data.disk.free : null;
  return (
    <div className="sysmon">
      <div className="gauges">
        <Ring value={data.cpu} label="CPU" sub={t('{n} mag · load {l}', { n: data.cpus, l: data.load[0].toFixed(2) })} />
        <Ring value={(memUsed / data.mem.total) * 100} label="RAM" sub={`${gb(memUsed)} / ${gb(data.mem.total)}`} />
        <Ring value={data.disk ? (diskUsed / data.disk.total) * 100 : null} label={t('LEMEZ')} sub={t('{v} szabad', { v: gb(data.disk?.free) })} />
      </div>
      <div className="sys-meta">
        <span>
          <span className="muted">HOST</span> {data.hostname}
        </span>
        <span>
          <span className="muted">UPTIME</span> {up(data.uptime)}
        </span>
        <span>
          <span className="muted">APP</span> {up(data.appUptime)}
        </span>
        <span>
          <span className="muted">DB</span> {(data.dbSize / 1024 ** 2).toFixed(1)} MB
        </span>
      </div>
    </div>
  );
}
