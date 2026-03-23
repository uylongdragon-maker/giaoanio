/**
 * Hàm phân bổ danh sách bài học vào lịch giảng dạy (Asymmetric, Cross-day)
 * @param {Array} syllabus - Mảng bài học, mỗi phần tử cần có: tenBai/name và soTiet/totalPeriods.
 * @param {String} startDate - Ngày bắt đầu (ISO string).
 * @param {Object} dayConfigs - Cấu hình tiết/ngày. VD: { 2: 2, 5: 3 } (Thứ 2: 2 tiết, Thứ 5: 3 tiết)
 * @returns {Array} sessions - Mảng các buổi học.
 */
export function generateTimetable(syllabus, startDate, dayConfigs) {
  if (!syllabus || syllabus.length === 0) return [];

  const validDays = Object.keys(dayConfigs)
    .map(Number)
    .filter(d => dayConfigs[d] > 0);

  if (!startDate || validDays.length === 0) return [];

  // ── Helper: Advance currentDate to the next valid teaching day ──
  const advanceToNextValidDay = (date) => {
    const d = new Date(date);
    // Max 14 days to find next valid day (safety)
    for (let i = 0; i < 14; i++) {
      if (validDays.includes(d.getDay())) return d;
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  // ── Normalize syllabus: clone and map to a consistent shape ──
  const remaining = syllabus.map((ls, idx) => ({
    lessonName: ls.name || ls.tenBai || `Bài ${idx + 1}`,
    periodsLeft: Number(ls.totalPeriods || ls.soTiet || 0),
    originalLesson: ls,
  })).filter(ls => ls.periodsLeft > 0);

  const sessions = [];
  let sessionCounter = 1;
  let currentDate = advanceToNextValidDay(new Date(startDate));

  // ── Main while-loop: keep scheduling until no lessons remain ──
  while (remaining.length > 0) {
    const dayOfWeek = currentDate.getDay();
    const periodsAllowed = dayConfigs[dayOfWeek] || 0;

    if (periodsAllowed === 0) {
      // This day is not a teaching day; advance
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate = advanceToNextValidDay(currentDate);
      continue;
    }

    const sessionContents = [];
    let periodsFilledToday = 0;

    // ── Fill this day's session with lessons until the quota is met ──
    while (periodsFilledToday < periodsAllowed && remaining.length > 0) {
      const lesson = remaining[0];
      const slotsLeft = periodsAllowed - periodsFilledToday;
      
      if (lesson.periodsLeft <= slotsLeft) {
        // Lesson fits completely into this day's remaining slots
        sessionContents.push({
          lessonName: lesson.lessonName,
          periods: lesson.periodsLeft,
          originalLesson: lesson.originalLesson,
        });
        periodsFilledToday += lesson.periodsLeft;
        remaining.shift(); // Remove lesson from queue
      } else {
        // Lesson is too long; fill available slots and carry over the rest
        sessionContents.push({
          lessonName: `${lesson.lessonName} (phần ${periodsFilledToday + 1})`,
          periods: slotsLeft,
          originalLesson: lesson.originalLesson,
        });
        lesson.periodsLeft -= slotsLeft; // Update remaining periods
        periodsFilledToday = periodsAllowed; // Day is now full
      }
    }

    if (sessionContents.length > 0) {
      sessions.push({
        id: `session-${sessionCounter}`,
        sessionNumber: sessionCounter,
        date: new Date(currentDate).toISOString(),
        totalPeriods: periodsFilledToday,
        status: 'pending',
        contents: sessionContents,
      });
      sessionCounter++;
    }

    // Advance to the next valid teaching day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = advanceToNextValidDay(currentDate);
  }

  return sessions;
}
