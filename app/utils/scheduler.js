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
    ltLeft: Number(ls.tietLT || 0),
    thLeft: Number(ls.tietTH || 0),
    originalLesson: ls,
  })).filter(ls => (ls.ltLeft + ls.thLeft) > 0);

  const sessions = [];
  let sessionCounter = 1;
  let currentDate = advanceToNextValidDay(new Date(startDate));

  // ── Main while-loop: keep scheduling until no lessons remain ──
  while (remaining.length > 0) {
    const dayOfWeek = currentDate.getDay();
    const periodsAllowed = dayConfigs[dayOfWeek] || 0;

    if (periodsAllowed === 0) {
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
      
      let ltToTake = 0;
      let thToTake = 0;

      // 1. Take LT first
      if (lesson.ltLeft > 0) {
        ltToTake = Math.min(lesson.ltLeft, slotsLeft);
        lesson.ltLeft -= ltToTake;
      }

      // 2. If slots remaining, take TH
      if (ltToTake < slotsLeft && lesson.thLeft > 0) {
        thToTake = Math.min(lesson.thLeft, slotsLeft - ltToTake);
        lesson.thLeft -= thToTake;
      }

      const totalTaken = ltToTake + thToTake;
      
      if (totalTaken > 0) {
        sessionContents.push({
          lessonName: lesson.lessonName,
          periods: totalTaken,
          tietLT: ltToTake,
          tietTH: thToTake,
          originalLesson: lesson.originalLesson,
        });
        periodsFilledToday += totalTaken;
      }

      // If lesson is fully scheduled, remove from queue
      if (lesson.ltLeft === 0 && lesson.thLeft === 0) {
        remaining.shift();
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

    currentDate.setDate(currentDate.getDate() + 1);
    currentDate = advanceToNextValidDay(currentDate);
  }

  return sessions;
}
