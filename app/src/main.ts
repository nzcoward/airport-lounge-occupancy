// main.ts
import {
    generate,
    results,
    clock,
    colour,
    contributingDepartures,
    landedCounts,
    flightMovements,
    aircraftSizes,
    dayNames,
    dayStart,
    timetablePatterns,
    type TerminalId,
    type DayOfWeek
} from "./model";

import "./style.css";

const app =
    document.querySelector<HTMLDivElement>("#app")!;


// Simulation state.

let seed = 42;
let loungeCount = 3;
let time = 720;
let selectedDay: DayOfWeek = 0;

let simulation = generate(seed, loungeCount);

function absoluteTime(): number {
    return dayStart(selectedDay) + time;
}


const terminalIds: TerminalId[] = [
    "T2", "T3", "T4", "T5"
];


// Schematic positions only.
const positions: Record<TerminalId, [number, number]> = {
    T2: [270, 55],
    T3: [450, 95],
    T4: [200, 245],
    T5: [450, 250]
};

const aircraftColours: Record<number, string> = {
    100: "#398b78",
    150: "#65a6c4",
    250: "#d5a34a",
    350: "#d47748",
    450: "#9a78b8"
};


function landedChart(terminalId: TerminalId): string {

    const width = 720;
    const height = 190;

    const left = 38;
    const right = 10;
    const top = 10;
    const bottom = 30;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const times: number[] = [];

    for (let minute = 240; minute <= 1410; minute += 30) {
        times.push(minute);
    }

    const data = times.map(minute =>
        landedCounts(simulation, terminalId, minute)
    );

    const maxCount = Math.max(
        1,
        ...data.map(row =>
            aircraftSizes.reduce(
                (sum, size) => sum + row[size],
                0
            )
        )
    );

    const scaleMax = Math.ceil(maxCount / 5) * 5;

    const barWidth = plotWidth / times.length * 0.72;

    const selectedX =
        left +
        ((time - 240) / (1410 - 240)) * plotWidth;

    const grid = [0, 0.25, 0.5, 0.75, 1]
        .map(fraction => {

            const y = top + plotHeight * (1 - fraction);
            const value = Math.round(scaleMax * fraction);

            return `
                <line
                    x1="${left}"
                    y1="${y}"
                    x2="${width - right}"
                    y2="${y}"
                    class="chart-grid"
                />
                <text
                    x="${left - 8}"
                    y="${y + 4}"
                    text-anchor="end"
                    class="chart-label"
                >${value}</text>
            `;
        }).join("");

    const bars = data.map((row, index) => {

        const x =
            left + index * (plotWidth / times.length) +
            (plotWidth / times.length - barWidth) / 2;

        let cumulative = 0;

        return aircraftSizes.map(size => {

            const count = row[size];

            const barHeight =
                count / scaleMax * plotHeight;

            const y =
                top + plotHeight -
                (cumulative + count) / scaleMax * plotHeight;

            cumulative += count;

            if (count === 0) return "";

            return `
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${barHeight}"
                    fill="${aircraftColours[size]}"
                    rx="1"
                >
                    <title>
                        ${clock(times[index])}: ${size} seats — ${count} flights
                    </title>
                </rect>
            `;
        }).join("");

    }).join("");

    const labels = [240, 480, 720, 960, 1200, 1410]
        .map(minute => {

            const x =
                left +
                ((minute - 240) / (1410 - 240)) * plotWidth;

            return `
                <text
                    x="${x}"
                    y="${height - 8}"
                    text-anchor="middle"
                    class="chart-label"
                >${clock(minute)}</text>
            `;
        }).join("");

    const legend = aircraftSizes.map(size => `
        <span class="chart-legend-item">
            <i style="background:${aircraftColours[size]}"></i>
            ${size} seats
        </span>
    `).join("");

    return `
        <div class="landed-chart">

            <div class="chart-legend">
                ${legend}
            </div>

            <svg
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Landed flights by aircraft size for terminal ${terminalId}"
            >
                ${grid}
                ${bars}

                <line
                    x1="${selectedX}"
                    y1="${top}"
                    x2="${selectedX}"
                    y2="${top + plotHeight}"
                    class="chart-selected"
                />

                ${labels}
            </svg>

            <p class="muted chart-caption">
                Flights on the ground, grouped by aircraft seat capacity.
                Vertical line indicates ${clock(time)}.
            </p>

        </div>
    `;
}

function movementChart(terminalId: TerminalId): string {

    const width = 720;
    const height = 220;

    const left = 42;
    const right = 12;
    const top = 12;
    const bottom = 32;

    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    const intervalMinutes = 30;
    const intervals = 40;

    const data = Array.from(
        { length: intervals },
        (_, index) => {

            const selectedDayStart = dayStart(selectedDay);
            const start = selectedDayStart + 240 + index * intervalMinutes;

            return {
                start,
                ...flightMovements(
                    simulation,
                    terminalId,
                    start,
                    intervalMinutes
                )
            };
        }
    );

    const maxCount = Math.max(
        1,
        ...data.flatMap(row => [
            aircraftSizes.reduce(
                (sum, size) => sum + row.arrivals[size],
                0
            ),
            aircraftSizes.reduce(
                (sum, size) => sum + row.departures[size],
                0
            )
        ])
    );

    const scaleMax = Math.max(
        5,
        Math.ceil(maxCount / 5) * 5
    );

    const groupWidth = plotWidth / intervals;
    const barWidth = groupWidth * 0.32;

    // Y-axis grid.

    const grid = [0, 0.25, 0.5, 0.75, 1]
        .map(fraction => {

            const y =
                top + plotHeight * (1 - fraction);

            const value =
                Math.round(scaleMax * fraction);

            return `
                <line
                    x1="${left}"
                    y1="${y}"
                    x2="${width - right}"
                    y2="${y}"
                    class="chart-grid"
                />

                <text
                    x="${left - 8}"
                    y="${y + 4}"
                    text-anchor="end"
                    class="chart-label"
                >${value}</text>
            `;
        }).join("");


    // Draw one stacked bar for each movement type.

    function drawStack(
        counts: Record<number, number>,
        x: number,
        label: string,
        intervalStart: number
    ): string {

        let cumulative = 0;

        return aircraftSizes.map(size => {

            const count = counts[size];

            if (count === 0) return "";

            const barHeight =
                count / scaleMax * plotHeight;

            const y =
                top + plotHeight -
                (cumulative + count) / scaleMax * plotHeight;

            cumulative += count;

            return `
                <rect
                    x="${x}"
                    y="${y}"
                    width="${barWidth}"
                    height="${barHeight}"
                    fill="${aircraftColours[size]}"
                    rx="1"
                >
                    <title>
                        ${clock(intervalStart)}–${clock(intervalStart + intervalMinutes)}:
                        ${label}, ${size} seats: ${count} flights
                    </title>
                </rect>
            `;
        }).join("");
    }


    // Two bars per interval: arrivals and departures.

    const bars = data.map((row, index) => {

        const groupX = left + index * groupWidth;

        const arrivalX =
            groupX + groupWidth * 0.12;

        const departureX =
            groupX + groupWidth * 0.56;

        return `
            ${drawStack(
            row.arrivals,
            arrivalX,
            "Arrivals",
            row.start
        )}

            ${drawStack(
            row.departures,
            departureX,
            "Departures",
            row.start
        )}
        `;
    }).join("");


    // Selected-time marker.
    const selectedX =
        left +
        ((time - 240) / 1200) * plotWidth;


    // Time labels every two hours.

    const labels = [
        240, 360, 480, 600, 720, 840,
        960, 1080, 1200, 1320, 1440
    ].map(minute => {

        const x =
            left +
            ((minute - 240) / 1200) * plotWidth;

        return `
            <text
                x="${x}"
                y="${height - 8}"
                text-anchor="middle"
                class="chart-label"
            >${clock(minute)}</text>
        `;
    }).join("");


    const aircraftLegend = aircraftSizes.map(size => `
        <span class="chart-legend-item">
            <i style="background:${aircraftColours[size]}"></i>
            ${size} seats
        </span>
    `).join("");


    return `
        <div class="landed-chart">

            <div class="chart-legend">

                <span class="chart-legend-item">
                    <i class="arrival-key"></i>
                    Arrivals
                </span>

                <span class="chart-legend-item">
                    <i class="departure-key"></i>
                    Departures
                </span>

                <span class="chart-legend-spacer"></span>

                ${aircraftLegend}

            </div>

            <svg
                viewBox="0 0 ${width} ${height}"
                role="img"
                aria-label="Arrivals and departures by aircraft size for terminal ${terminalId}"
            >

                ${grid}

                ${bars}

                <line
                    x1="${selectedX}"
                    y1="${top}"
                    x2="${selectedX}"
                    y2="${top + plotHeight}"
                    class="chart-selected"
                />

                ${labels}

            </svg>

            <p class="muted chart-caption">
                Each pair of bars represents a 30-minute interval.
                Hover over a bar segment for its count.
                Selected time: ${clock(time)}.
            </p>

        </div>
    `;
}

function render() {

    const currentMinute = absoluteTime();
    const data = results(simulation, currentMinute);

    const totalOccupancy = data.reduce(
        (sum, lounge) => sum + lounge.occupancy,
        0
    );

    const totalCapacity = data.reduce(
        (sum, lounge) =>
            sum + lounge.comfortableCapacity,
        0
    );

    const contributing = contributingDepartures(
        simulation,
        currentMinute
    );

    const dailyDepartures = simulation.flights.filter(
        flight =>
            Math.floor(flight.departureMinute / 1440) === selectedDay
    ).length;

    app.innerHTML = `

  <main class="wrap">

    <header>
      <div>
        <div class="eyebrow">
          SIMULATION WORKBENCH
        </div>

        <h1>Heathrow lounge occupancy</h1>

        <p class="muted">
          Synthetic one-day schedule · deterministic seed · multiple lounges per terminal
        </p>
      </div>

      <span class="pill">
        ${simulation.flights.length.toLocaleString()} departures this week
      </span>
    </header>


    <section class="metrics">

      <article>
        <small>People in lounges now</small>
        <b>${Math.round(totalOccupancy)}</b>
      </article>

      <article>
        <small>Combined utilisation</small>
        <b>
          ${Math.round(
        totalOccupancy / totalCapacity * 100
    )}%
        </b>
        <small>
          ${totalCapacity} comfortable capacity
        </small>
      </article>

      <article>
        <small>Contributing departures</small>
        <b>${contributing}</b>
      </article>
      
      <article>
        <small>Terminals / lounges</small>
        <b>5 / ${data.length}</b>
      </article>

      <article>
        <small>Flights contributing to lounge numbers</small>
        <b>${contributing}</b>
        <small>At ${clock(time)}</small>
      </article>

      <article>
        <small>Departures on selected day</small>
        <b>${dailyDepartures}</b>
      </article>

      <article>
        <small>Flights contributing to lounge numbers</small>
        <b>${contributing}</b>
        <small>At ${clock(time)}</small>
      </article>

    </section>


    <section class="panel">

      <div class="row">

        <div>
          <h2>Simulation controls</h2>

          <p class="muted">
            Adjust time, seed and lounge count per terminal.
          </p>
        </div>

      <strong class="time">
        ${dayNames[selectedDay]} · ${clock(time)}
      </strong>

      </div>

      <label>Day of week</label>

      <select id="day">
        ${dayNames.map((name, index) => `
        <option
          value="${index}"
          ${index === selectedDay ? "selected" : ""}
        >
          ${name}
        </option>
        `).join("")}
      </select>


      <label>Time of day</label>

      <input
        id="time"
        type="range"
        min="240"
        max="1410"
        step="15"
        value="${time}"
      >

      <div class="ends">
        <span>04:00 · lounges open</span>
        <span>23:30 · last departure</span>
      </div>


      <div class="quick">
        ${[360, 540, 720, 900, 1080, 1230, 1410]
            .map(t => `
            <button data-t="${t}">
              ${clock(t)}
            </button>
          `).join("")}
      </div>


      <div class="settings">

        <label>
          Seed
          <input
            id="seed"
            type="number"
            value="${seed}"
          >
        </label>

        <label>
          Lounges per terminal

          <select id="count">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
            .map(n => `
                <option
                  value="${n}"
                  ${n === loungeCount ? "selected" : ""}
                >
                  ${n}
                </option>
              `).join("")}
          </select>
        </label>

        <button id="regen" class="primary">
          Regenerate
        </button>

      </div>

    </section>


    <section class="panel">

      <div class="row">

        <div>
          <h2>Schematic terminal map</h2>

          <p class="muted">
            Each dot is a lounge; colour and size indicate occupancy.
          </p>
        </div>

        <div class="legend">
          🟢 Low &nbsp;
          🟡 Busy &nbsp;
          🟠 High &nbsp;
          🔴 At/over capacity
        </div>

      </div>


      <div class="map">

        <svg viewBox="0 0 550 315">

          <path
            d="M95 80 L270 55 L450 95
               M95 80 L200 245 L450 250
               M270 55 L450 95"
            class="connector"
          />

          ${terminalIds.map(id => {

                const [x, y] = positions[id];

                return `
              <g>
                <rect
                  x="${x - 32}"
                  y="${y - 18}"
                  width="64"
                  height="36"
                  rx="10"
                  class="terminal"
                />

                <text
                  x="${x}"
                  y="${y + 5}"
                  text-anchor="middle"
                >
                  ${id}
                </text>
              </g>
            `;
            }).join("")}


          ${data.map(lounge => {

                const siblings = data.filter(
                    x => x.terminalId === lounge.terminalId
                );

                const index = siblings.findIndex(
                    x => x.id === lounge.id
                );

                const [cx, cy] =
                    positions[lounge.terminalId];

                const x =
                    cx + (
                        index - (siblings.length - 1) / 2
                    ) * 17;

                const y =
                    cy + (cy < 150 ? 39 : -39);

                const radius =
                    5 + Math.min(
                        9,
                        lounge.utilisation * 9
                    );

                return `
              <circle
                cx="${x}"
                cy="${y}"
                r="${radius + 2}"
                fill="white"
              />

              <circle
                cx="${x}"
                cy="${y}"
                r="${radius}"
                fill="${colour(lounge.utilisation)}"
              >
                <title>
                  ${lounge.name}:
                  ${Math.round(lounge.occupancy)} people
                </title>
              </circle>
            `;
            }).join("")}

        </svg>

      </div>

    </section>


    ${terminalIds.map(terminalId => {

        const lounges = data.filter(
            lounge => lounge.terminalId === terminalId
        );

        const terminalFlights = simulation.flights.filter(
            flight => flight.terminalId === terminalId
        );

        const weeklyDepartures = terminalFlights.length;

        const selectedDayDepartures = terminalFlights.filter(
            flight =>
                Math.floor(flight.departureMinute / 1440) === selectedDay
        ).length;

        const departures =
            simulation.flights.filter(
                flight => flight.terminalId === terminalId
            ).length;

        const occupancy = lounges.reduce(
            (sum, lounge) => sum + lounge.occupancy,
            0
        );

        return `

        <section class="panel">

          <div class="row">

            <div>
              <h2>Terminal ${terminalId.slice(1)}</h2>

            <p class="muted">
              ${weeklyDepartures} departures this week ·
              ${selectedDayDepartures} on ${dayNames[selectedDay]} ·
              ${lounges.length} lounges
            </p>
            </div>

            <b>${Math.round(occupancy)} people now</b>

          </div>
          <div class="landed-section">

            <h3>Flights on the ground</h3>

            <p class="muted">
                Assumed aircraft presence based on aircraft size
                and scheduled departure.
            </p>

            ${landedChart(terminalId)}

            ${movementChart(terminalId)}

        </div>

          <div class="cards">

            ${lounges.map(lounge => `

              <article class="lounge">

                <div class="row">

                  <div>
                    <h3>${lounge.name}</h3>

                    <small>
                      ${lounge.walkingMinutes} min synthetic walk ·
                      preference ${lounge.preference.toFixed(2)}
                    </small>
                  </div>

                  <strong>
                    ${Math.round(lounge.occupancy)}
                  </strong>

                </div>


                <div class="bar">
                  <i
                    style="
                      width:${Math.max(
                    0,
                    Math.min(
                        100,
                        lounge.utilisation * 100
                    )
                )}%;
                      background:${colour(lounge.utilisation)}
                    "
                  ></i>
                </div>


                <div class="row muted">
                  <span>
                    ${Math.round(
                    lounge.utilisation * 100
                )}% utilisation
                  </span>

                  <span>
                    Capacity ${lounge.comfortableCapacity}
                  </span>
                </div>


                <small>
                  Expected visitors this week:
                  ${Math.round(lounge.expectedWeeklyVisitors)}
                </small>

              </article>

            `).join("")}

          </div>

        </section>

      `;
            }).join("")}


    <section class="panel">

      <h2>Model assumptions</h2>

      <div class="assumptions">
        <span><b>700</b> departures</span>
        <span><b>06:00–23:30</b> departure window</span>
        <span><b>100–450</b> seats</span>
        <span><b>72–95%</b> load factor</span>
        <span><b>20–40%</b> broad lounge access</span>
        <span><b>04:00</b> opening</span>
      </div>

      <p class="muted note">
        Demand is split between lounges in the flight's terminal using preference multiplied by exponential walking-time decay.

        Survival is linearly interpolated between 0/30/60/90/120/180 minutes at 100/98/90/75/50/15%, then held at 15% until departure.

        All data is synthetic.
      </p>

      <p class="muted note">
        Broad lounge access is randomly assigned per flight, between 20% and 40%, using the simulation seed.
        Aircraft presence is assumed to be 30 minutes for 100/150-seat aircraft, 60 minutes for 250-seat aircraft, and 120 minutes for 350/450-seat aircraft.
        Flights arriving before 04:00 are treated as overnight aircraft already on the ground.
      </p>

    </section>

    <section class="panel">
    <h2>Weekly timetable configuration</h2>

    <p class="muted">
        These are the recurring service groups used
        to generate the weekly flight instances.
    </p>

    <div class="cards">
        ${timetablePatterns.map(pattern => `
            <article class="lounge">
                <h3>${pattern.label}</h3>

                <b>${pattern.count} timetables</b>

                <small>
                    ${pattern.departuresPerDay} departures per operating day
                </small>

                <small>
                    ${pattern.operatingDays.map(
                        day => dayNames[day].slice(0, 3)
                    ).join(", ")}
                </small>

                <small>
                    ${pattern.count *
            pattern.departuresPerDay *
            pattern.operatingDays.length}
                    departures per week
                </small>
            </article>
        `).join("")}
    </div>

    <p class="muted">
        Total recurring timetables:
        ${simulation.timetables.length}
        · Weekly flight instances:
        ${simulation.flights.length.toLocaleString()}
    </p>
</section>


    <footer>
      Local TypeScript prototype · Vite
    </footer>

  </main>

  `;

    // Day Selector
    document
        .querySelector<HTMLSelectElement>("#day")!
        .addEventListener("change", event => {

            selectedDay = Number(
                (event.target as HTMLSelectElement).value
            ) as DayOfWeek;

            render();
        });

    // Time slider.

    document
        .querySelector<HTMLInputElement>("#time")!
        .addEventListener("input", event => {

            time = Number(
                (event.target as HTMLInputElement).value
            );

            render();
        });


    // Quick time buttons.

    document
        .querySelectorAll<HTMLButtonElement>("[data-t]")
        .forEach(button => {

            button.addEventListener("click", () => {

                time = Number(button.dataset.t);

                render();
            });
        });


    // Regenerate using a new seed or lounge count.

    document
        .querySelector<HTMLButtonElement>("#regen")!
        .addEventListener("click", () => {

            seed = Number(
                document.querySelector<HTMLInputElement>(
                    "#seed"
                )!.value
            ) || 1;

            loungeCount = Number(
                document.querySelector<HTMLSelectElement>(
                    "#count"
                )!.value
            );

            simulation = generate(seed, loungeCount);

            render();
        });
}


render();
