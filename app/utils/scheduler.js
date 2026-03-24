/**
 * Hàm phân bổ danh sách bài học vào lịch giảng dạy (Pro Edition)
 * Theo thuật toán: Chia nhỏ đề mục -> Rải tiết theo pLimit -> Né ngày nghỉ
 * 
 * @param {Array} syllabus - Mảng bài học từ Editable Table.
 * @param {String} startDate - Ngày bắt đầu (YYYY-MM-DD).
 * @param {Object} dayConfigs - Cấu hình tiết/ngày. { 2: 4, 3: 0, ... }
 * @param {Array} holidayList - Mảng chuỗi ngày nghỉ (Date.toDateString()).
 * @returns {Array} sessions - Mảng các buổi học hoàn chỉnh.
 */
export function generateTimetable(syllabus, startDate, dayConfigs, holidayList = []) {
  if (!syllabus || syllabus.length === 0 || !startDate) return [];

  // 1. CHUẨN BỊ TẤT CẢ CÁC BƯỚC (STEPS)
  // Mỗi bài học được chia thành các đề mục con (sub-items).
  // Mỗi đề mục con có phần LT và phần TH riêng.
  let allSteps = [];

  syllabus.forEach((item, idx) => {
    let hLt = parseFloat(item.gioLT) || 0;
    let hTh = parseFloat(item.gioTH) || 0;
    
    // Đề mục chi tiết: tách theo dấu phẩy
    let subList = (item.deMuc || "")
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== "");
    
    if (subList.length === 0) {
      subList = [item.tenBai || `Bài ${idx + 1}`];
    }

    // Tính số tiết cho mỗi đề mục con
    // Quy đổi từ GIỜ sang TIẾT: LT (1:1), TH (x 60/45)
    // Phân bổ đều cho các đề mục con
    const pPerLt = hLt / subList.length;
    const pPerTh = (hTh * (60 / 45)) / subList.length;

    subList.forEach(s => {
      // Thêm phần Lý thuyết của đề mục này
      if (pPerLt > 0) {
        allSteps.push({
          parentTitle: item.tenBai,
          subTitle: s,
          type: 'LT',
          remaining: pPerLt,
          originalItem: item
        });
      }
      // Thêm phần Thực hành của đề mục này (Xen kẽ ngay sau LT)
      if (pPerTh > 0) {
        allSteps.push({
          parentTitle: item.tenBai,
          subTitle: s,
          type: 'TH',
          remaining: pPerTh,
          originalItem: item
        });
      }
    });
  });

  // 2. RẢI CÁC BƯỚC VÀO LỊCH (SESSIONS)
  let sessions = [];
  let currentDate = new Date(startDate);
  let stepIdx = 0;
  let sessionCounter = 1;

  // Giới hạn an toàn 500 buổi để tránh vòng lặp vô tận
  while (stepIdx < allSteps.length && sessions.length < 500) {
    const dayOfWeek = currentDate.getDay();
    const pLimit = dayConfigs[dayOfWeek] || 0;
    const dateStr = currentDate.toDateString();

    // Nếu là ngày dạy và không phải ngày nghỉ
    if (pLimit > 0 && !holidayList.includes(dateStr)) {
      let currentSession = {
        id: `session-${sessionCounter}`,
        sessionNumber: sessionCounter,
        date: currentDate.toISOString(),
        contents: [],
        totalPeriods: 0,
        tietLT: 0,
        tietTH: 0,
        status: 'pending'
      };

      let spaceUsed = 0;

      while (spaceUsed < pLimit - 0.01 && stepIdx < allSteps.length) {
        let step = allSteps[stepIdx];
        let availableSpace = pLimit - spaceUsed;
        let take = Math.min(step.remaining, availableSpace);

        // Ghi nhận nội dung cho buổi này
        currentSession.contents.push({
          lessonName: step.parentTitle,
          subItem: step.subTitle,
          periods: take,
          type: step.type,
          tietLT: step.type === 'LT' ? take : 0,
          tietTH: step.type === 'TH' ? take : 0,
          originalLesson: step.originalItem
        });

        if (step.type === 'LT') currentSession.tietLT += take;
        else currentSession.tietTH += take;

        spaceUsed += take;
        step.remaining -= take;

        // Nếu bước này đã hết tiết, chuyển sang bước tiếp theo
        if (step.remaining <= 0.01) {
          stepIdx++;
        }
      }

      currentSession.totalPeriods = spaceUsed;
      sessions.push(currentSession);
      sessionCounter++;
    }

    // Sang ngày tiếp theo
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}
