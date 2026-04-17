import './RoomCard.css';

function getComfortIndicator(room) {
  if (!room.co2) return { cls: 'neutral', label: '--' };
  const t = room.co2.temperature_c;
  if (t == null) return { cls: 'neutral', label: '--' };
  if (t < 19) return { cls: 'cold', label: 'Froid' };
  if (t > 24) return { cls: 'hot', label: 'Chaud' };
  return { cls: 'comfort', label: 'Confort' };
}

export default function RoomCard({ room }) {
  const totalW = room.total_w ?? 0;
  const plugCount = room.plugs?.length ?? 0;
  const activeCount = room.plugs?.filter((p) => (p.power_w || 0) > 1).length ?? 0;
  const comfort = getComfortIndicator(room);

  return (
    <div className="room-card-h">
      <div
        className="room-card-accent"
        style={{ background: room.color || '#475569' }}
      />
      <div className="room-card-body">
        <div className="room-card-name">{room.name}</div>
        <div className="room-card-stats">
          <span className="room-card-watts">{totalW.toFixed(0)} W</span>
          <span className="room-card-plugs">{activeCount}/{plugCount}</span>
          {room.co2 && (
            <span className="room-card-temp">
              {room.co2.temperature_c?.toFixed(1)}°
            </span>
          )}
        </div>
      </div>
      <div className={`room-card-comfort comfort-${comfort.cls}`}>
        <span className="comfort-dot" />
      </div>
    </div>
  );
}
