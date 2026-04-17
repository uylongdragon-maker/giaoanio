/**
 * ============================================================
 * MODULE: THUẬT TOÁN PHÂN BỔ THỜI GIAN THEO TỶ LỆ CẮT LÁT (WATERFALL)
 * ============================================================
 * Quy tắc quy đổi:
 *   1 Giờ LT (Lý thuyết)  = 45 phút
 *   1 Giờ TH (Thực hành)  = 60 phút
 *   1 Giờ KLT/KTH (KT)    = 60 phút
 *   1 Giờ TLT/TTH (Thi)   = 60 phút
 *
 * Thuật toán: Dàn phẳng toàn bộ thời lượng bài học xuống và cắt chính xác
 * bằng capacity của buổi (VD: 4 tiết = 180 phút). Chữ "đề mục" sẽ được gói vào.
 * Không xáo trộn thứ tự, không ưu tiên loại bài.
 * ============================================================
 */

const MINUTES_PER_PERIOD = 45; // 1 tiết = 45 phút

/**
 * Lấy ngày dạy tiếp theo (bỏ qua nghỉ lễ, ngày không có tiết).
 */
function getNextTeachingDay(date, dayConfigs, holidaySet) {
  const d = new Date(date);
  let safety = 0;
  while (safety < 730) {
    const dayOfWeek = d.getDay();
    const periods = dayConfigs[dayOfWeek] || 0;
    const iso = d.toISOString().split('T')[0];
    if (periods > 0 && !holidaySet.has(iso)) {
      return { date: new Date(d), periods, iso };
    }
    d.setDate(d.getDate() + 1);
    safety++;
  }
  return null;
}

/**
 * HÀM CHÍNH: generateScheduleAlgorithm
 * @param {Array}  syllabus    - Đề cương (array bài học từ Step3)
 * @param {string} startDate   - 'YYYY-MM-DD'
 * @param {Object} dayConfigs  - { 0: 0, 1: 4, 2: 0, ... } (0=CN, 1-6=T2-T7)
 * @param {Array}  holidayList - ['YYYY-MM-DD', ...]
 * @param {number} periodsPerSession - Số tiết/buổi (mặc định 4 = 180p)
 * @returns {Array} sessions
 */
export function generateScheduleAlgorithm(
  syllabus,
  startDate,
  dayConfigs,
  holidayList = [],
  periodsPerSession = 4 // Không thực sự dùng, sẽ lấy số tiết từng ngày
) {
  if (!syllabus || syllabus.length === 0 || !startDate) return [];

  const holidaySet = new Set(holidayList);
  
  // ─────────────────────────────────────────────
  // BƯỚC 1: Dàn phẳng đề cương thành các tiểu mục (Sub-items)
  // ─────────────────────────────────────────────
  const queue = [];
  syllabus.forEach((item, idx) => {
    // Tính tổng phút của toàn bộ bài này dựa trên số TIẾT và Loại tiết
    const ltMinutes = Math.round((parseFloat(item.gioLT) || 0) * 45);
    const thMinutes = Math.round((parseFloat(item.gioTH) || 0) * 60);
    const ktMinutes = Math.round((parseFloat(item.gioKLT || 0) + parseFloat(item.gioKTH || 0)) * 60);
    const thiMinutes = Math.round((parseFloat(item.gioTLT || 0) + parseFloat(item.gioTTH || 0)) * 60);
    
    let totalMinutes = ltMinutes + thMinutes + ktMinutes + thiMinutes;
    if (totalMinutes <= 0) return; // Bỏ qua nếu thời gian bằng 0

    // Bóc tách mảng tieuMuc từ Dữ liệu cứng
    const rawLines = Array.isArray(item.tieuMuc) ? item.tieuMuc : [];
    const subItems = rawLines.length > 0 ? rawLines : [item.tenBai || `Bài ${idx + 1}`];

    // Chia đều thời gian tổng vào từng tiểu mục con
    const baseMins = Math.floor(totalMinutes / subItems.length);
    const extraMins = totalMinutes % subItems.length;

    subItems.forEach((line, lineIdx) => {
      const allocatedMins = baseMins + (lineIdx === 0 ? extraMins : 0); // đập phần dư vào dòng đầu
      if (allocatedMins > 0) {
        // Tự động chuyển đổi "1." -> "1.1", "2." -> "1.2" để chuyên nghiệp hơn
        let displayLabel = line;
        const lessonNumber = idx + 1;
        
        if (line.match(/^[0-9]+[\.\)]/)) {
          const subNumMatch = line.match(/^([0-9]+)[\.\)]/);
          const contentText = line.replace(/^[0-9]+[\.\)]/, "").trim();
          displayLabel = `${lessonNumber}.${subNumMatch[1]} ${contentText}`;
        }

        queue.push({
          lessonName: item.tenBai || `Bài ${lessonNumber}`,
          subItem: displayLabel,
          remainTotal: allocatedMins,
        });
      }
    });
  });

  // ─────────────────────────────────────────────
  // BƯỚC 2: Cắt lát Tuần tự (Waterfall Slicing)
  // ─────────────────────────────────────────────
  const sessions = [];
  let currentDate = new Date(startDate + 'T00:00:00');
  let sessionCounter = 1;
  let qIdx = 0;

  while (qIdx < queue.length && sessions.length < 500) {
    const dayInfo = getNextTeachingDay(currentDate, dayConfigs, holidaySet);
    if (!dayInfo) break; // Hết lịch

    const sessionCapacityMinutes = dayInfo.periods * MINUTES_PER_PERIOD;
    let remainingCapacity = sessionCapacityMinutes;
    const sessionContents = [];

    // Nhồi liên tục queue vào session cho đến khi hết dung lượng buổi
    while (remainingCapacity > 0.5 && qIdx < queue.length) {
      const currentChunk = queue[qIdx];
      const takeMinutes = Math.min(currentChunk.remainTotal, remainingCapacity);
      
      sessionContents.push({
        lessonName: currentChunk.lessonName,
        subItem: currentChunk.subItem,
        allocatedMinutes: takeMinutes
      });

      currentChunk.remainTotal -= takeMinutes;
      remainingCapacity -= takeMinutes;

      // Nếu chunk này cạn thời gian, tiến tới bài tiếp theo trong đề cương
      if (currentChunk.remainTotal <= 0.5) {
        qIdx++;
      }
    }

    if (sessionContents.length > 0) {
      // Build tiêu đề buổi: Liệt kê các bài độc nhất có trong buổi này
      const names = [...new Set(sessionContents.map(c => c.lessonName).filter(Boolean))];
      const sessionTitle = names.length <= 2 
        ? names.join(' & ') 
        : names[0] + ` & ${names.length - 1} bài khác`;

      // Thu thập mảng các tiểu mục đã được cắt (Flat array)
      const slicedSubItems = [...new Set(sessionContents.map(c => c.subItem).filter(Boolean))];

      sessions.push({
        id: `session-${sessionCounter}`,
        sessionNumber: sessionCounter,
        date: dayInfo.iso,
        sessionTitle: sessionTitle,
        totalPeriods: dayInfo.periods,
        totalMinutes: sessionCapacityMinutes,
        contents: sessionContents,
        slicedSubItems: slicedSubItems,
        status: 'pending',
      });
      sessionCounter++;
    }

    // Sang ngày tiếp theo
    currentDate = new Date(dayInfo.date);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}
