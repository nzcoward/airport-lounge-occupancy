export type TerminalId =
    | "T2" | "T3" | "T4" | "T5";

export type DayOfWeek =
    | 0 | 1 | 2 | 3 | 4 | 5 | 6;

// Monday = 0, Sunday = 6.

export interface TimetablePattern {
    id: string;
    label: string;
    count: number;
    operatingDays: DayOfWeek[];
    departuresPerDay: number;
}

// EDIT THESE COUNTS AND OPERATING DAYS TO CHANGE
// THE SHAPE OF THE GENERATED WEEKLY SCHEDULE.

export const timetablePatterns: TimetablePattern[] = [
    {
        id: "daily",
        label: "Daily services",
        count: 200,
        operatingDays: [0, 1, 2, 3, 4, 5, 6],
        departuresPerDay: 1
    },
    {
        id: "four-daily",
        label: "Four times daily",
        count: 75,
        operatingDays: [0, 1, 2, 3, 4, 5, 6],
        departuresPerDay: 4
    },
    {
        id: "twice-daily",
        label: "Twice daily",
        count: 60,
        operatingDays: [0, 1, 2, 3, 4, 5, 6],
        departuresPerDay: 2
    },
    {
        id: "mwf",
        label: "Monday / Wednesday / Friday",
        count: 100,
        operatingDays: [0, 2, 4],
        departuresPerDay: 1
    },
    {
        id: "tuth",
        label: "Tuesday / Thursday",
        count: 50,
        operatingDays: [1, 3],
        departuresPerDay: 1
    },
    {
        id: "weekend",
        label: "Weekend only",
        count: 100,
        operatingDays: [5, 6],
        departuresPerDay: 1
    }
];

export interface FlightTimetable {
    id: string;
    patternId: string;
    terminalId: TerminalId;
    seats: number;
    loadFactor: number;
    accessShare: number;
    operatingDays: DayOfWeek[];
    departureMinutesOfDay: number[];
}

export interface FlightInstance {
    id: string;
    timetableId: string;
    terminalId: TerminalId;

    // Absolute minute from Monday 00:00.
    departureMinute: number;

    seats: number;
    loadFactor: number;
    accessShare: number;
}

export interface Lounge {
    id: string;
    terminalId: TerminalId;
    name: string;
    comfortableCapacity: number;
    preference: number;
    walkingMinutes: number;
}

export interface Cohort {
    flightId: string;
    loungeId: string;
    terminalId: TerminalId;
    departureMinute: number;
    checkInMinute: number;
    expectedVisitors: number;
}

export interface LoungeResult extends Lounge {
    occupancy: number;
    utilisation: number;
    expectedWeeklyVisitors: number;
}

export interface Simulation {
    timetables: FlightTimetable[];
    flights: FlightInstance[];
    lounges: Lounge[];
    cohorts: Cohort[];
}

export const terminals: TerminalId[] = [
    "T2", "T3", "T4", "T5"
];

export const aircraftCapacities = [
    100, 150, 250, 350, 450
];

export const aircraftSizes = [
    100, 150, 250, 350, 450
] as const;

export const aircraftPresenceMinutes: Record<number, number> = {
    100: 30,
    150: 30,
    250: 60,
    350: 120,
    450: 120
};

export const arrivalProfile = [
    { minutesBeforeDeparture: 180, share: 0.10 },
    { minutesBeforeDeparture: 150, share: 0.15 },
    { minutesBeforeDeparture: 120, share: 0.25 },
    { minutesBeforeDeparture: 90, share: 0.25 },
    { minutesBeforeDeparture: 60, share: 0.15 },
    { minutesBeforeDeparture: 30, share: 0.10 }
];

const survivalPoints = [
    [0, 1.00],
    [30, 0.98],
    [60, 0.90],
    [90, 0.75],
    [120, 0.50],
    [180, 0.15]
] as const;

export const MINUTES_PER_DAY = 1440;
export const MINUTES_PER_WEEK = 10080;
export const LOUNGE_OPEN_MINUTE = 240;


// Deterministic pseudo-random generator.

export function rng(seed: number) {
    let a = seed >>> 0;

    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;

        let t = Math.imul(
            a ^ (a >>> 15),
            1 | a
        );

        t = (
            t +
            Math.imul(t ^ (t >>> 7), 61 | t)
        ) ^ t;

        return (
            (t ^ (t >>> 14)) >>> 0
        ) / 4294967296;
    };
}


// Survival probability.

export function survival(minutes: number): number {
    if (minutes <= 0) return 1;
    if (minutes >= 180) return 0.15;

    for (let i = 1; i < survivalPoints.length; i++) {
        const [x1, y1] = survivalPoints[i - 1];
        const [x2, y2] = survivalPoints[i];

        if (minutes <= x2) {
            const fraction =
                (minutes - x1) / (x2 - x1);

            return y1 + fraction * (y2 - y1);
        }
    }

    return 0.15;
}


// Generate departure times within the day.
// Multiple departures are spread across the operating day,
// rather than clustered randomly around one another.

function generateDepartureTimes(count: number, random: () => number): number[] {

    const windows: [number, number][] = {
        1: [[360, 1410]],
        2: [[360, 840], [840, 1410]],
        4: [
            [360, 600],
            [600, 840],
            [840, 1080],
            [1080, 1410]
        ]
    }[count] ?? [[360, 1410]];

    return windows.map(([start, end]) =>
        Math.floor(start + random() * (end - start))
    );
}


// Generate weekly timetables and dated instances.

export function generate(seed: number, loungeCount: number): Simulation {

    const random = rng(seed);

    const timetables: FlightTimetable[] = [];
    const flights: FlightInstance[] = [];
    const lounges: Lounge[] = [];
    const cohorts: Cohort[] = [];


    // Generate lounges.

    for (const terminalId of terminals) {
        for (let i = 0; i < loungeCount; i++) {
            lounges.push({
                id: `${terminalId}-L${i + 1}`,
                terminalId,
                name: `${terminalId} Lounge ${i + 1}`,

                comfortableCapacity:
                    [120, 160, 200, 240][
                    Math.floor(random() * 4)
                    ],

                preference:
                    0.75 + random() * 0.5,

                walkingMinutes:
                    3 + Math.floor(random() * 18)
            });
        }
    }


    // Generate recurring flight timetables.

    let timetableNumber = 1;

    for (const pattern of timetablePatterns) {

        for (let i = 0; i < pattern.count; i++) {

            const terminalId =
                terminals[Math.floor(random() * terminals.length)];

            const seats =
                aircraftCapacities[
                Math.floor(random() * aircraftCapacities.length)
                ];

            const loadFactor =
                0.72 + random() * 0.23;

            const accessShare =
                0.20 + random() * 0.20;

            const departureMinutesOfDay =
                generateDepartureTimes(
                    pattern.departuresPerDay,
                    random
                );

            const timetable: FlightTimetable = {
                id: `TT${timetableNumber++}`,
                patternId: pattern.id,
                terminalId,
                seats,
                loadFactor,
                accessShare,
                operatingDays: [...pattern.operatingDays],
                departureMinutesOfDay
            };

            timetables.push(timetable);


            // Expand the recurring timetable into
            // individual dated flight instances.

            for (const day of timetable.operatingDays) {

                for (
                    let departureIndex = 0;
                    departureIndex < departureMinutesOfDay.length;
                    departureIndex++
                ) {

                    const departureMinute =
                        day * MINUTES_PER_DAY +
                        departureMinutesOfDay[departureIndex];

                    const flight: FlightInstance = {
                        id: `${timetable.id}-D${day}-F${departureIndex + 1}`,
                        timetableId: timetable.id,
                        terminalId,
                        departureMinute,
                        seats,
                        loadFactor,
                        accessShare
                    };

                    flights.push(flight);


                    // Estimate lounge passengers.

                    const expectedPassengers =
                        seats * loadFactor;

                    const expectedLoungeUsers =
                        expectedPassengers * accessShare;


                    // Find lounges in the flight's terminal.

                    const options = lounges
                        .filter(lounge =>
                            lounge.terminalId === terminalId
                        )
                        .map(lounge => ({
                            lounge,

                            weight:
                                lounge.preference *
                                Math.exp(
                                    -0.055 * lounge.walkingMinutes
                                )
                        }));

                    const totalWeight = options.reduce(
                        (sum, option) => sum + option.weight,
                        0
                    );


                    // Allocate visitors across lounges and
                    // arrival cohorts.

                    for (const { lounge, weight } of options) {

                        const visitorsToLounge =
                            expectedLoungeUsers *
                            weight / totalWeight;

                        for (const arrival of arrivalProfile) {

                            const dayStart =
                                day * MINUTES_PER_DAY;

                            const checkInMinute = Math.max(
                                dayStart + LOUNGE_OPEN_MINUTE,
                                departureMinute -
                                arrival.minutesBeforeDeparture
                            );

                            if (checkInMinute >= departureMinute) {
                                continue;
                            }

                            cohorts.push({
                                flightId: flight.id,
                                loungeId: lounge.id,
                                terminalId,
                                departureMinute,
                                checkInMinute,

                                expectedVisitors:
                                    visitorsToLounge * arrival.share
                            });
                        }
                    }
                }
            }
        }
    }

    return {
        timetables,
        flights,
        lounges,
        cohorts
    };
}


// Calculate lounge occupancy at an absolute week minute.

export function results(simulation: Simulation, minute: number): LoungeResult[] {

    const occupancy = new Map<string, number>();
    const weeklyVisitors = new Map<string, number>();

    for (const cohort of simulation.cohorts) {

        weeklyVisitors.set(
            cohort.loungeId,
            (weeklyVisitors.get(cohort.loungeId) ?? 0) +
            cohort.expectedVisitors
        );

        if (minute < cohort.checkInMinute || minute >= cohort.departureMinute) {
            continue;
        }

        const remaining =
            cohort.expectedVisitors *
            survival(minute - cohort.checkInMinute);

        occupancy.set(
            cohort.loungeId,
            (occupancy.get(cohort.loungeId) ?? 0) +
            remaining
        );
    }

    return simulation.lounges.map(lounge => {

        const people = occupancy.get(lounge.id) ?? 0;

        return {
            ...lounge,
            occupancy: people,
            utilisation: people / lounge.comfortableCapacity,
            expectedWeeklyVisitors:
                weeklyVisitors.get(lounge.id) ?? 0
        };
    });
}


// Count distinct flights contributing to lounge occupancy.

export function contributingDepartures(
    simulation: Simulation,
    minute: number
): number {

    const activeFlights = new Set<string>();

    for (const cohort of simulation.cohorts) {
        if (
            minute >= cohort.checkInMinute &&
            minute < cohort.departureMinute &&
            cohort.expectedVisitors > 0
        ) {
            activeFlights.add(cohort.flightId);
        }
    }

    return activeFlights.size;
}


// Aircraft currently on the ground, by size.

export function landedCounts(
    simulation: Simulation,
    terminalId: TerminalId,
    minute: number
): Record<number, number> {

    const counts: Record<number, number> = {
        100: 0, 150: 0, 250: 0, 350: 0, 450: 0
    };

    for (const flight of simulation.flights) {

        if (flight.terminalId !== terminalId) continue;

        const dayStart =
            Math.floor(flight.departureMinute / MINUTES_PER_DAY) *
            MINUTES_PER_DAY;

        const arrivalMinute = Math.max(
            dayStart + LOUNGE_OPEN_MINUTE,
            flight.departureMinute -
            aircraftPresenceMinutes[flight.seats]
        );

        if (
            minute >= arrivalMinute &&
            minute < flight.departureMinute
        ) {
            counts[flight.seats]++;
        }
    }

    return counts;
}


export interface FlightMovementCounts {
    arrivals: Record<number, number>;
    departures: Record<number, number>;
}


// Count movements in [intervalStart, intervalEnd).

export function flightMovements(
    simulation: Simulation,
    terminalId: TerminalId,
    intervalStart: number,
    intervalMinutes = 30
): FlightMovementCounts {

    const arrivals: Record<number, number> = {
        100: 0, 150: 0, 250: 0, 350: 0, 450: 0
    };

    const departures: Record<number, number> = {
        100: 0, 150: 0, 250: 0, 350: 0, 450: 0
    };

    const intervalEnd = intervalStart + intervalMinutes;

    for (const flight of simulation.flights) {

        if (flight.terminalId !== terminalId) continue;

        const dayStart =
            Math.floor(flight.departureMinute / MINUTES_PER_DAY) *
            MINUTES_PER_DAY;

        const arrivalMinute =
            flight.departureMinute -
            aircraftPresenceMinutes[flight.seats];

        const effectiveArrival = Math.max(
            dayStart + LOUNGE_OPEN_MINUTE,
            arrivalMinute
        );

        // Do not count pre-opening arrivals as new arrivals.

        if (
            arrivalMinute >= dayStart + LOUNGE_OPEN_MINUTE &&
            arrivalMinute >= intervalStart &&
            arrivalMinute < intervalEnd
        ) {
            arrivals[flight.seats]++;
        }

        if (
            flight.departureMinute >= intervalStart &&
            flight.departureMinute < intervalEnd
        ) {
            departures[flight.seats]++;
        }
    }

    return { arrivals, departures };
}


// Formatting helpers.

export function clock(minute: number): string {
    const minuteOfDay =
        ((Math.round(minute) % MINUTES_PER_DAY) +
            MINUTES_PER_DAY) % MINUTES_PER_DAY;

    const hours = Math.floor(minuteOfDay / 60);
    const mins = minuteOfDay % 60;

    return (
        `${String(hours).padStart(2, "0")}:` +
        `${String(mins).padStart(2, "0")}`
    );
}

export const dayNames = [
    "Monday", "Tuesday", "Wednesday", "Thursday",
    "Friday", "Saturday", "Sunday"
];

export function dayStart(day: DayOfWeek): number {
    return day * MINUTES_PER_DAY;
}

export function colour(utilisation: number): string {
    if (utilisation >= 1) return "#c94d45";
    if (utilisation >= 0.75) return "#d58b35";
    if (utilisation >= 0.4) return "#c2a84a";
    return "#398b78";
}