export const CAREGO_SERVICE_START_HOUR = 7;
export const CAREGO_SERVICE_END_HOUR = 19;
export const CAREGO_BOOKING_LOOKAHEAD_DAYS = 7;
export const CAREGO_INSTANT_TARGET_LEAD_MINUTES = 15;
export const CAREGO_INSTANT_MIN_LEAD_MINUTES = 5;
export const CAREGO_INSTANT_MAX_LEAD_MINUTES = 30;
export const CAREGO_INSTANT_SLOT_MINUTES = 5;
export const DEFAULT_COMPANION_WORKING_SHIFT = "full_day";

export const COMPANION_WORKING_SHIFTS = {
  morning: {
    label: "Buổi sáng",
    startHour: 7,
    endHour: 13,
  },
  afternoon: {
    label: "Buổi chiều",
    startHour: 13,
    endHour: 19,
  },
  full_day: {
    label: "Cả ngày",
    startHour: 7,
    endHour: 19,
  },
};

export const normalizeWorkingShift = (value) =>
  Object.hasOwn(COMPANION_WORKING_SHIFTS, value) ? value : DEFAULT_COMPANION_WORKING_SHIFT;

export const getWorkingShiftLabel = (value) =>
  COMPANION_WORKING_SHIFTS[normalizeWorkingShift(value)].label;

export const getBookingEndTime = (booking) =>
  new Date(new Date(booking.startTime).getTime() + Number(booking.durationHours || 0) * 60 * 60 * 1000);

export const getRequestedEndTime = (startTime, durationHours) =>
  new Date(new Date(startTime).getTime() + Number(durationHours || 0) * 60 * 60 * 1000);

export const isTimeOverlapped = (firstStart, firstEnd, secondStart, secondEnd) =>
  firstStart < secondEnd && secondStart < firstEnd;

const atHour = (date, hour) => {
  const value = new Date(date);
  value.setHours(hour, 0, 0, 0);
  return value;
};

const sameLocalDay = (first, second) =>
  first.getFullYear() === second.getFullYear() &&
  first.getMonth() === second.getMonth() &&
  first.getDate() === second.getDate();

export const parseBookingAvailabilityWindow = ({
  startTime,
  durationHours,
  now = new Date(),
  requireFuture = true,
} = {}) => {
  const start = new Date(startTime);
  const duration = Number(durationHours);

  if (Number.isNaN(start.getTime()) || !Number.isInteger(duration) || duration < 1) {
    return { error: "Thời gian đặt lịch hoặc thời lượng không hợp lệ." };
  }

  if (start.getMinutes() !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) {
    return { error: "Giờ bắt đầu phải theo từng cặp giờ tròn, ví dụ 07:00 - 08:00." };
  }

  if (requireFuture && start <= now) {
    return { error: "Thời gian bắt đầu sai, quý khách vui lòng chọn lại." };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const maxStart = new Date(today);
  maxStart.setDate(maxStart.getDate() + CAREGO_BOOKING_LOOKAHEAD_DAYS);
  if (start < today || start >= maxStart) {
    return { error: "Chỉ có thể đặt lịch trong 7 ngày gần nhất." };
  }

  const end = getRequestedEndTime(start, duration);
  const serviceStart = atHour(start, CAREGO_SERVICE_START_HOUR);
  const serviceEnd = atHour(start, CAREGO_SERVICE_END_HOUR);
  if (!sameLocalDay(start, end) || start < serviceStart || end > serviceEnd) {
    return { error: "Ca làm việc chỉ nhận lịch từ 07:00 đến 19:00 trong cùng một ngày." };
  }

  return { start, end, durationHours: duration };
};

export const getSuggestedInstantStartTime = (now = new Date()) => {
  const start = new Date(now.getTime() + CAREGO_INSTANT_TARGET_LEAD_MINUTES * 60 * 1000);
  start.setSeconds(0, 0);
  const roundedMinutes = Math.ceil(start.getMinutes() / CAREGO_INSTANT_SLOT_MINUTES) * CAREGO_INSTANT_SLOT_MINUTES;
  start.setMinutes(roundedMinutes);
  return start;
};

export const parseInstantBookingAvailabilityWindow = ({
  startTime,
  durationHours,
  now = new Date(),
} = {}) => {
  const start = new Date(startTime);
  const duration = Number(durationHours);

  if (Number.isNaN(start.getTime()) || !Number.isInteger(duration) || duration < 1) {
    return { error: "Thời gian đặt ngay hoặc thời lượng không hợp lệ." };
  }

  if (
    start.getSeconds() !== 0 ||
    start.getMilliseconds() !== 0 ||
    start.getMinutes() % CAREGO_INSTANT_SLOT_MINUTES !== 0
  ) {
    return { error: "Thời gian đặt ngay phải theo mốc 5 phút." };
  }

  const leadMinutes = (start.getTime() - now.getTime()) / (60 * 1000);
  if (leadMinutes < CAREGO_INSTANT_MIN_LEAD_MINUTES || leadMinutes > CAREGO_INSTANT_MAX_LEAD_MINUTES) {
    return { error: "Booking đặt ngay phải bắt đầu trong khoảng 5 đến 30 phút tới." };
  }

  const end = getRequestedEndTime(start, duration);
  const serviceStart = atHour(start, CAREGO_SERVICE_START_HOUR);
  const serviceEnd = atHour(start, CAREGO_SERVICE_END_HOUR);
  if (!sameLocalDay(start, end) || start < serviceStart || end > serviceEnd) {
    return { error: "Ca làm việc chỉ nhận lịch từ 07:00 đến 19:00 trong cùng một ngày." };
  }

  return { start, end, durationHours: duration };
};

export const isWithinCompanionWorkingShift = (workingShift, startTime, durationHours) => {
  const shift = COMPANION_WORKING_SHIFTS[normalizeWorkingShift(workingShift)];
  const start = new Date(startTime);
  const end = getRequestedEndTime(start, durationHours);
  const shiftStart = atHour(start, shift.startHour);
  const shiftEnd = atHour(start, shift.endHour);

  return sameLocalDay(start, end) && start >= shiftStart && end <= shiftEnd;
};
