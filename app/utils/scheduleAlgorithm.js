/**
 * ============================================================
 * MODULE: THUẬT TOÁN PHÂN BỔ THỜI GIAN THEO TỶ LỆ 45/60
 * ============================================================
 * Quy tắc quy đổi:
 *   1 Giờ LT (Lý thuyết)  = 45 phút
 *   1 Giờ TH (Thực hành)  = 60 phút
 *   1 Giờ KLT/KTH (KT)    = 60 phút
 *   1 Giờ TLT/TTH (Thi)   = 60 phút
 *
 * Sức chứa 1 buổi (4 tiết)  = 4 × 45 = 180 phút
 *
 * Thuật toán: First-Fit Bin Packing theo đơn vị phút.
 * ============================================================
 */

const MINUTES_PER_PERIOD = 45; // 1 tiết = 45 phút

/**
 * Quy đổi giờ LT → phút.
 * @param {number} hours
 * @returns {number} minutes
 */
function ltToMinutes(hours) {
  return Math.round((parseFloat(hours) || 0) * MINUTES_PER_PERIOD);
}

/**
 * Quy đổi giờ TH/KT/Thi → phút.
 * @param {number} hours
 * @returns {number} minutes
 */
function thToMinutes(hours) {
  return Math.round((parseFloat(hours) || 0) * 60);
}

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
 * Tự động nhận diện loại buổi học từ contents.
 * @param {Array} contents
 * @returns {'LÝ THUYẾT'|'THỰC HÀNH'|'TÍCH HỢP'|'KIỂM TRA'|'THI'}
 */
function autoTagSession(contents) {
  let totalLT = 0, totalTH = 0, totalKT = 0, totalThi = 0;
  contents.forEach(c => {
    totalLT  += c.gioLT_used  || 0;
    totalTH  += c.gioTH_used  || 0;
    totalKT  += (c.gioKLT_used || 0) + (c.gioKTH_used || 0);
    totalThi += (c.gioTLT_used || 0) + (c.gioTTH_used || 0);
  });
  if (totalThi > 0) return 'THI';
  if (totalKT  > 0) return 'KIỂM TRA';
  if (totalLT > 0 && totalTH > 0) return 'TÍCH HỢP';
  if (totalTH > 0) return 'THỰC HÀNH';
  return 'LÝ THUYẾT';
}

/**
 * Tạo sessionTitle từ danh sách tên bài (lấy duy nhất, ngắn gọn).
 */
function buildSessionTitle(contents) {
  const names = [...new Set(contents.map(c => c.lessonName).filter(Boolean))];
  if (names.length === 0) return 'Buổi học';
  if (names.length === 1) return names[0];
  // Nếu có nhiều bài, lấy tên đầu + rút gọn
  return names[0] + (names.length > 1 ? ` & ${names.length - 1} bài khác` : '');
}

/**
 * ============================================================
 * HÀM CHÍNH: generateScheduleAlgorithm
 * ============================================================
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
  periodsPerSession = 4
) {
  if (!syllabus || syllabus.length === 0 || !startDate) return [];

  const SESSION_CAPACITY = periodsPerSession * MINUTES_PER_PERIOD; // phút/buổi
  const holidaySet = new Set(holidayList);

  // ─────────────────────────────────────────────
  // BƯỚC 1: Phân rã đề cương thành các "CHUNK" phút
  // Mỗi chunk = { lessonName, subItem, type, ltMin, thMin, ktMin, thiMin, isIndependent }
  // ─────────────────────────────────────────────
  const chunks = []; // { lessonRef, subItem, type, remainLT, remainTH, remainKT, remainThi, isIndependent }

  syllabus.forEach((item, idx) => {
    const name = (item.tenBai || '').toLowerCase();
    const isFinalExam  = name.includes('thi kết thúc') || name.includes('thi tốt nghiệp')
                      || (parseFloat(item.gioTLT) > 0) || (parseFloat(item.gioTTH) > 0);
    const isKiemTra    = name.includes('kiểm tra')
                      || (parseFloat(item.gioKLT) > 0) || (parseFloat(item.gioKTH) > 0);

    const ltMin  = isFinalExam ? 0 : ltToMinutes(item.gioLT);
    const thMin  = isFinalExam ? 0 : thToMinutes(item.gioTH);
    const ktMin  = isFinalExam ? 0 : thToMinutes((parseFloat(item.gioKLT)||0) + (parseFloat(item.gioKTH)||0));
    const thiMin = isFinalExam ? SESSION_CAPACITY : thToMinutes((parseFloat(item.gioTLT)||0) + (parseFloat(item.gioTTH)||0));

    const subItemText = (item.deMuc || '')
      .split('\n').map(s => s.trim()).filter(Boolean).join('; ')
      || item.tenBai || `Bài ${idx + 1}`;

    chunks.push({
      lessonName: item.tenBai || `Bài ${idx + 1}`,
      subItem: subItemText,
      isIndependent: isFinalExam, // Buổi thi phải chiếm trọn 1 buổi
      isKiemTra,
      remainLT:  ltMin,
      remainTH:  thMin,
      remainKT:  ktMin,
      remainThi: thiMin,
    });
  });

  // ─────────────────────────────────────────────
  // BƯỚC 2: BIN PACKING — nhét từng chunk vào các buổi
  // Ưu tiên: LT trước → TH → KT → Thi
  // Buổi thi (isIndependent) phải chiếm buổi riêng
  // ─────────────────────────────────────────────
  const sessions = [];
  let currentDate = new Date(startDate + 'T00:00:00');
  let sessionCounter = 1;
  let chunkIdx = 0;

  // Trạng thái nhét trong từng chunk: đang nhét loại nào
  // (LT → TH → KT → Thi)

  while (chunkIdx < chunks.length && sessions.length < 500) {
    // Tìm ngày dạy tiếp theo
    const dayInfo = getNextTeachingDay(currentDate, dayConfigs, holidaySet);
    if (!dayInfo) break; // Hết lịch

    const capacity = dayInfo.periods * MINUTES_PER_PERIOD;
    let remaining = capacity; // phút còn trống trong buổi này

    const sessionContents = [];

    // Kiểm tra: chunk đầu tiên cần nhét có phải thi độc lập không?
    const nextChunk = chunks[chunkIdx];
    if (nextChunk.isIndependent && sessionContents.length === 0) {
      // Buổi thi: chiếm toàn bộ capacity
      sessionContents.push({
        lessonName:  nextChunk.lessonName,
        subItem:     nextChunk.subItem,
        gioLT_used:  0,
        gioTH_used:  0,
        gioKLT_used: 0,
        gioKTH_used: 0,
        gioTLT_used: 0,
        gioTTH_used: +(capacity / 60).toFixed(2),
        type:        'Thi',
      });
      nextChunk.remainThi = 0;
      chunkIdx++;
      remaining = 0;
    } else {
      // Vòng lặp nhét từng chunk vào buổi hiện tại
      while (remaining > 0.5 && chunkIdx < chunks.length) {
        const chunk = chunks[chunkIdx];

        // Nếu gặp buổi thi độc lập và buổi này đã có nội dung → kết thúc buổi
        if (chunk.isIndependent && sessionContents.length > 0) break;

        let tookAny = false;

        // --- Nhét LT ---
        if (chunk.remainLT > 0.5) {
          const take = Math.min(chunk.remainLT, remaining);
          const takeHours = +(take / MINUTES_PER_PERIOD).toFixed(4);
          // Tìm hoặc tạo content entry cho bài này
          let entry = sessionContents.find(c => c.lessonName === chunk.lessonName && c.type !== 'Thi' && c.type !== 'Kiểm tra');
          if (!entry) {
            entry = {
              lessonName:  chunk.lessonName,
              subItem:     chunk.subItem,
              gioLT_used:  0,
              gioTH_used:  0,
              gioKLT_used: 0,
              gioKTH_used: 0,
              gioTLT_used: 0,
              gioTTH_used: 0,
              type:        'Lý thuyết',
            };
            sessionContents.push(entry);
          }
          entry.gioLT_used = +((entry.gioLT_used || 0) + takeHours).toFixed(4);
          chunk.remainLT -= take;
          remaining     -= take;
          tookAny = true;
        }

        // --- Nhét TH ---
        if (chunk.remainTH > 0.5 && remaining > 0.5) {
          const take = Math.min(chunk.remainTH, remaining);
          const takeHours = +(take / 60).toFixed(4);
          let entry = sessionContents.find(c => c.lessonName === chunk.lessonName);
          if (!entry) {
            entry = {
              lessonName:  chunk.lessonName,
              subItem:     chunk.subItem,
              gioLT_used:  0,
              gioTH_used:  0,
              gioKLT_used: 0,
              gioKTH_used: 0,
              gioTLT_used: 0,
              gioTTH_used: 0,
              type:        'Thực hành',
            };
            sessionContents.push(entry);
          }
          entry.gioTH_used = +((entry.gioTH_used || 0) + takeHours).toFixed(4);
          if (entry.gioLT_used > 0) entry.type = 'Tích hợp';
          else entry.type = 'Thực hành';
          chunk.remainTH -= take;
          remaining      -= take;
          tookAny = true;
        }

        // --- Nhét KT ---
        if (chunk.remainKT > 0.5 && remaining > 0.5) {
          const take = Math.min(chunk.remainKT, remaining);
          const takeHours = +(take / 60).toFixed(4);
          const entry = {
            lessonName:  chunk.lessonName,
            subItem:     'Kiểm tra',
            gioLT_used:  0,
            gioTH_used:  0,
            gioKLT_used: takeHours,
            gioKTH_used: 0,
            gioTLT_used: 0,
            gioTTH_used: 0,
            type:        'Kiểm tra',
          };
          sessionContents.push(entry);
          chunk.remainKT -= take;
          remaining      -= take;
          tookAny = true;
        }

        // --- Nhét Thi ---
        if (chunk.remainThi > 0.5 && remaining > 0.5) {
          const take = Math.min(chunk.remainThi, remaining);
          const takeHours = +(take / 60).toFixed(4);
          const entry = {
            lessonName:  chunk.lessonName,
            subItem:     'Thi kết thúc',
            gioLT_used:  0,
            gioTH_used:  0,
            gioKLT_used: 0,
            gioKTH_used: 0,
            gioTLT_used: 0,
            gioTTH_used: takeHours,
            type:        'Thi',
          };
          sessionContents.push(entry);
          chunk.remainThi -= take;
          remaining       -= take;
          tookAny = true;
        }

        // Nếu chunk đã được nhét hết → sang chunk tiếp
        const chunkDone = chunk.remainLT  <= 0.5
                       && chunk.remainTH  <= 0.5
                       && chunk.remainKT  <= 0.5
                       && chunk.remainThi <= 0.5;
        if (chunkDone) {
          chunkIdx++;
        } else {
          // Chunk chưa xong nhưng buổi đã đầy → sang buổi mới
          break;
        }

        if (!tookAny) {
          chunkIdx++; // Tránh vòng lặp vô tận
        }
      }
    }

    if (sessionContents.length > 0) {
      const sessionTag  = autoTagSession(sessionContents);
      const totalMinutes = dayInfo.periods * MINUTES_PER_PERIOD;

      sessions.push({
        id:           `session-${sessionCounter}`,
        sessionNumber: sessionCounter,
        date:          dayInfo.iso,
        sessionTitle:  buildSessionTitle(sessionContents),
        lessonType:    sessionTag,
        totalPeriods:  dayInfo.periods,
        totalMinutes,
        contents:      sessionContents,
        status:        'pending',
      });
      sessionCounter++;
    }

    // Chuyển sang ngày hôm sau để tìm ngày dạy tiếp
    currentDate = new Date(dayInfo.date);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}
