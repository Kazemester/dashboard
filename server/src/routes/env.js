import { Router } from 'express';
import { getWidget } from '../util.js';
import { airQuality, weather } from '../services/openmeteo.js';

const r = Router();

r.get('/widgets/:id/air', async (req, res) => {
  const w = await getWidget(req.params.id, 'air');
  res.json(await airQuality(w.config.city || 'Budapest'));
});

r.get('/widgets/:id/sun', async (req, res) => {
  const w = await getWidget(req.params.id, 'sun');
  const wx = await weather(w.config.city || 'Budapest');
  res.json({
    place: wx.place,
    days: wx.daily.time.map((day, i) => ({
      day,
      sunrise: wx.daily.sunrise[i],
      sunset: wx.daily.sunset[i],
      daylight: wx.daily.daylight_duration[i],
      uv: wx.daily.uv_index_max[i],
    })),
  });
});

export default r;
