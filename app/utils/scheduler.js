/**
 * Hàm phân bổ danh sách bài học vào lịch giảng dạy (Pro Edition)
 * Chiến lược: Nhóm theo Hình thức (LT/TH) -> Đảm bảo Buổi thi Độc lập -> Tiêu chuẩn 180 phút
 * 
 * @param {Array} syllabus - Mảng bài học từ Editable Table.
 * @param {String} startDate - Ngày bắt đầu (YYYY-MM-DD).
 * @param {Object} dayConfigs - Cấu hình tiết/ngày.
 * @param {Array} holidayList - Mảng chuỗi ngày nghỉ.
 * @returns {Array} sessions - Mảng các buổi học hoàn chỉnh.
 */
export function generateTimetable(syllabus, startDate, dayConfigs, holidayList = []) {
  if (!syllabus || syllabus.length === 0 || !startDate) return [];

  // 1. CHUẨN BỊ CÁC KHỐI NỘI DUNG (BLOCKS)
  // Ưu tiên gom nhóm cùng loại (LT/TH) để tạo ra các "Buổi thuần"
  let allBlocks = [];

  syllabus.forEach((item, idx) => {
    // Tổng hợp giờ từ tất cả các cột
    const hLt = (parseFloat(item.gioLT) || 0) + (parseFloat(item.gioKLT) || 0) + (parseFloat(item.gioTLT) || 0);
    const hTh = (parseFloat(item.gioTH) || 0) + (parseFloat(item.gioKTH) || 0) + (parseFloat(item.gioTTH) || 0);
    
    // Nhận diện loại bài (Thi, Kiểm tra)
    const name = (item.tenBai || "").toLowerCase();
    const isFinalExam = name.includes("thi kết thúc") || name.includes("thi tốt nghiệp") || (parseFloat(item.gioTTH) > 0);
    const isPeriodicTest = name.includes("kiểm tra") || (parseFloat(item.gioKLT) > 0) || (parseFloat(item.gioKTH) > 0);

    const pLt = hLt;
    const pTh = Math.round(hTh * 60 / 45);
    
    const subList = (item.deMuc || "").split(',').map(s => s.trim()).filter(Boolean);
    const effectiveSubItems = subList.length > 0 ? subList.join(", ") : (item.tenBai || `Bài ${idx + 1}`);

    if (isFinalExam) {
      // Buổi thi: Mặc định 4 tiết (180p) và Độc lập
      allBlocks.push({
        title: item.tenBai,
        subItem: "Nội dung thi kết thúc môn",
        periods: 4,
        type: 'Thực hành',
        isExam: true,
        independent: true
      });
    } else {
      // Khối Lý thuyết
      if (pLt > 0) {
        allBlocks.push({
          title: item.tenBai,
          subItem: effectiveSubItems,
          periods: pLt,
          type: 'Lý thuyết',
          isExam: isPeriodicTest
        });
      }
      // Khối Thực hành
      if (pTh > 0) {
        allBlocks.push({
          title: item.tenBai,
          subItem: effectiveSubItems,
          periods: pTh,
          type: 'Thực hành',
          isExam: isPeriodicTest
        });
      }
    }
  });

  // 2. PHÂN BỔ VÀO CÁC BUỔI (SESSIONS)
  let sessions = [];
  let currentDate = new Date(startDate + 'T00:00:00');
  let blockIdx = 0;
  let sessionCounter = 1;

  while (blockIdx < allBlocks.length && sessions.length < 500) {
    const dayOfWeek = currentDate.getDay();
    const pLimit = dayConfigs[dayOfWeek] || 0;
    const dateISO = currentDate.toISOString().split('T')[0];
    const dateReadable = currentDate.toDateString(); 

    // Kiểm tra ngày dạy và ngày nghỉ (hỗ trợ cả 2 định dạng ISO và Readable)
    if (pLimit > 0 && !holidayList.includes(dateISO) && !holidayList.includes(dateReadable)) {
      let currentSession = {
        id: `session-${sessionCounter}`,
        sessionNumber: sessionCounter,
        date: dateISO,
        contents: [],
        totalPeriods: 0,
        status: 'pending'
      };

      let space = pLimit;
      
      while (space > 0.01 && blockIdx < allBlocks.length) {
        let block = allBlocks[blockIdx];
        
        // NẾU BÀI TIẾP THEO LÀ THI ĐỘC LẬP: Kết thúc buổi cũ ngay
        if (block.independent && currentSession.contents.length > 0) {
          break;
        }

        let take = Math.min(block.periods, space);
        
        // Nếu là bài thi độc lập: Ép chiếm trọn 180p (space)
        if (block.independent) {
          take = space;
        }

        currentSession.contents.push({
          lessonName: block.title,
          subItem: block.subItem,
          periods: take,
          type: block.type
        });

        currentSession.totalPeriods += take;
        space -= take;
        block.periods -= take;

        if (block.periods <= 0.01) {
          blockIdx++;
        }
        
        // Ngừng ghép sau khi đã chèn bài thi
        if (blockIdx < allBlocks.length && allBlocks[blockIdx].independent) {
          break;
        }
      }

      sessions.push(currentSession);
      sessionCounter++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return sessions;
}

/**
 * Hàm tính toán danh sách các ngày dạy thực tế
 */
export function getActualTeachingDates(startDate, dayConfigs, holidayList = [], totalRequiredPeriods = 0) {
  let dates = [];
  if (!startDate) return [];
  let currentDate = new Date(startDate + 'T00:00:00');
  let accumulated = 0;
  let safe = 0;
  
  while (accumulated < totalRequiredPeriods && safe < 365) {
    const dayOfWeek = currentDate.getDay();
    const pLimit = dayConfigs[dayOfWeek] || 0;
    const dateISO = currentDate.toISOString().split('T')[0];
    const dateReadable = currentDate.toDateString();
    
    if (pLimit > 0 && !holidayList.includes(dateISO) && !holidayList.includes(dateReadable)) {
      dates.push(new Date(currentDate));
      accumulated += pLimit;
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
    safe++;
  }
  
  return dates;
}
