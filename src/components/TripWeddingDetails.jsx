import React from 'react'

const DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const formatWeddingDay = input => {
  const [year, month, day] = String(input || '2027-02-13').split('-').map(Number)
  return { year, month, day }
}

function WeddingCalendar({ date }) {
  const { year, month, day } = formatWeddingDay(date)
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1))).toUpperCase()
  return <div className="rounded-[18px] bg-white p-4 sm:p-5 text-[#183259]">
    <div className="font-serif text-center text-[22px] sm:text-[27px] tracking-[0.12em]">{monthName}</div>
    <div className="grid grid-cols-7 gap-y-1.5 mt-4 text-center">
      {DAYS.map((label, index) => <div key={index} className="text-[11px] sm:text-[12px] font-bold pb-1">{label}</div>)}
      {Array.from({ length: offset + count }, (_, index) => {
        const number = index - offset + 1
        return <div key={index} className="min-w-0 h-8 flex items-center justify-center text-[12px] sm:text-[13px]">
          {number > 0 ? number === day
            ? <span className="relative w-9 h-9 flex items-center justify-center" aria-label={'Matrimonio: ' + day + ' de ' + monthName.toLowerCase()}>
                <span aria-hidden="true" className="absolute text-[#172F60] leading-none text-[44px] top-[-4px]">♥</span>
                <strong className="relative text-white text-[12px] font-medium">{number}</strong>
              </span>
            : number
            : ''}
        </div>
      })}
    </div>
  </div>
}

export default function TripWeddingDetails({ plan }) {
  if (!plan?.weddingVenue) return null
  const schedule = Array.isArray(plan.weddingProgram) ? plan.weddingProgram : []
  const date = formatWeddingDay(plan.weddingDate)
  const month = String(date.month).padStart(2, '0')
  const mapUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(plan.weddingAddress || plan.weddingVenue)
  return <section className="space-y-3" aria-label="Matrimonio: lugar y programa">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[20px] sm:text-[22px] font-bold">El matrimonio</h2>
        <p className="text-[11px] text-[#71888A] mt-1">Invitación confirmada · Información para tener a mano durante el viaje</p>
      </div>
      <span className="text-[10px] text-[#1C6280] font-bold px-3 py-1.5 bg-[#E8F0F5] rounded-full shrink-0">13 FEB 2027</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-4">
      <div className="rounded-[20px] bg-[#142C57] text-white px-4 py-5 sm:px-6 sm:py-6">
        <div className="font-serif text-center text-[24px] sm:text-[28px] tracking-[0.04em] mb-4">LOS ESPERAMOS</div>
        <WeddingCalendar date={plan.weddingDate}/>
        <div className="text-center mt-4">
          <div className="font-serif text-[23px] sm:text-[29px] tracking-[0.12em]">{date.day} · {month} · {date.year}</div>
          <div className="font-serif text-[23px] sm:text-[27px] mt-1">17:00 <span className="text-[15px]">HRS</span></div>
        </div>
        <div className="mt-5 pt-4 border-t border-white/20 text-center">
          <div className="text-[10px] uppercase tracking-wider text-[#C2D4ED]">Lugar del evento</div>
          <div className="mt-1.5 font-bold text-[14px]">{plan.weddingVenue}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-[#D4DEEB]">{plan.weddingAddress}</div>
          <a className="mt-3 inline-flex rounded-lg px-3 py-2 bg-white/15 border border-white/20 hover:bg-white/25 text-[11px] font-semibold" href={mapUrl} target="_blank" rel="noopener noreferrer">Ver ubicación en Google Maps ↗</a>
        </div>
      </div>
      <div className="rounded-[20px] bg-[#142C57] text-white px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif tracking-[0.055em] text-[20px] sm:text-[26px]">PROGRAMA DEL DÍA</h3>
          <span className="text-[11px] text-[#C9D9ED]">Sábado 13</span>
        </div>
        <div className="mt-5 space-y-0">
          {schedule.map((event, index) => <div key={event.time + index}
              className={'grid grid-cols-[1fr_1px_76px] sm:grid-cols-[1fr_1px_88px] gap-4 sm:gap-5 items-center min-h-[44px] py-2 ' + (event.dayOffset ? 'bg-white/10 rounded-lg px-2 -mx-2 mt-2' : '')}>
            <div className="text-[12px] sm:text-[14px] text-[#EAF0F8] text-right leading-snug">
              {event.label}{Boolean(event.dayOffset) && <div className="text-[9px] uppercase tracking-wider text-[#B5C7E0] mt-1">Domingo 14</div>}
            </div>
            <div className="h-full min-h-[28px] bg-[#C2D1E2]/55"/>
            <div className="font-serif text-[22px] sm:text-[26px] text-white tabular-nums">{event.time}</div>
          </div>)}
        </div>
        <div className="mt-5 p-3 rounded-xl border border-[#6C8FB7]/30 bg-white/10 text-[11px] leading-relaxed text-[#E5EDF7]">
          <strong>Para el regreso:</strong> la despedida es a las 03:00 del domingo. Conviene dejar el vuelo de vuelta para más tarde y considerar el descanso y los traslados hasta Curicó.
        </div>
      </div>
    </div>
    <div className="trip-panel p-4 sm:p-5">
      <h3 className="font-bold text-[16px]">Traslados que debemos coordinar</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        <div className="rounded-xl bg-[#F1F5F4] p-3.5">
          <div className="text-[10px] font-bold text-[#6F8C8D] uppercase">Curicó → Santiago</div>
          <div className="text-[18px] font-bold mt-1">2 h 30 min</div>
          <p className="text-[11px] text-[#6C8082] mt-1">$12.000 por persona ida/vuelta</p>
        </div>
        <div className="rounded-xl bg-[#F1F5F4] p-3.5">
          <div className="text-[10px] font-bold text-[#6F8C8D] uppercase">Terminal → Aeropuerto SCL</div>
          <div className="text-[18px] font-bold mt-1">35 min</div>
          <p className="text-[11px] text-[#6C8082] mt-1">Turbus · $2.100 por tramo/persona</p>
        </div>
        <div className="rounded-xl bg-[#F1F5F4] p-3.5">
          <div className="text-[10px] font-bold text-[#6F8C8D] uppercase">Santiago → Antofagasta</div>
          <div className="text-[18px] font-bold mt-1">2 horas</div>
          <p className="text-[11px] text-[#6C8082] mt-1">Vuelo directo · con bolso de mano</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#698385]">Los tiempos son aproximados y no incluyen espera, conexiones, controles de seguridad ni desplazamiento desde el aeropuerto de Antofagasta al Airbnb.</p>
    </div>
  </section>
}