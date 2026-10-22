import * as XLSX from 'xlsx';
import { Student, Subject, Incident, ClassSettings } from '../types';

// Helper to save workbook to browser
export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

// 1. Download Student List Template
export function downloadStudentTemplate() {
  const wsData = [
    ['Mã học sinh', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Họ tên phụ huynh', 'SĐT phụ huynh', 'Địa chỉ', 'Ghi chú'],
    ['02102013', 'Huỳnh Ngọc Trâm Anh', 'Nữ', '02/10/2013', 'Huỳnh Văn A', '0901234567', 'TP. Hồ Chí Minh', 'Lớp phó học tập'],
    ['27122013', 'Trần Ngô Quỳnh Anh', 'Nữ', '27/12/2013', 'Trần Văn B', '0912345678', 'TP. Hồ Chí Minh', ''],
    ['26052013', 'Nguyễn Gia Bảo', 'Nam', '26/05/2013', 'Nguyễn Văn C', '0923456789', 'TP. Hồ Chí Minh', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  // Column widths
  ws['!cols'] = [
    { wch: 15 }, // Mã học sinh
    { wch: 25 }, // Họ tên
    { wch: 10 }, // Giới tính
    { wch: 15 }, // Ngày sinh
    { wch: 22 }, // Phụ huynh
    { wch: 15 }, // SĐT
    { wch: 25 }, // Địa chỉ
    { wch: 20 }, // Ghi chú
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách mẫu');
  downloadWorkbook(wb, 'Mau_Nhap_Hoc_Sinh.xlsx');
}

// 2. Parse Student Excel File
export function parseStudentExcel(file: File): Promise<Array<Partial<Student>>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

        if (rawJson.length < 2) {
          throw new Error('Tệp Excel không có dòng dữ liệu nào.');
        }

        // Auto-detect header row within first 10 rows
        let headerRowIdx = 0;
        for (let r = 0; r < Math.min(10, rawJson.length); r++) {
          const rowText = (rawJson[r] || []).map((c: any) => String(c || '').toLowerCase()).join(' ');
          if (rowText.includes('họ') || rowText.includes('tên') || rowText.includes('học sinh') || rowText.includes('stt')) {
            headerRowIdx = r;
            break;
          }
        }

        const headers = (rawJson[headerRowIdx] || []).map((h: any) => String(h || '').trim().toLowerCase());
        
        // Find code / ID column: look for "mã", "id", or fallback to "stt"
        let codeIdx = headers.findIndex(h => h.includes('mã') || h === 'id' || h.includes('định danh'));
        if (codeIdx < 0) {
          codeIdx = headers.findIndex(h => h.includes('stt'));
        }

        // Detect separate surname and first name columns common in VN school software (vnEdu, SMAS)
        const hoDemIdx = headers.findIndex(h => 
          (h.includes('họ') && !h.includes('học') && !h.includes('tên')) || 
          h.includes('họ đệm') || 
          h.includes('chữ lót') || 
          h.includes('họ và tên lót') ||
          h.includes('họ và chữ lót')
        );
        const tenIdx = headers.findIndex(h => 
          (h.includes('tên') && !h.includes('họ') && !h.includes('mã') && !h.includes('phụ')) || 
          h === 'tên'
        );

        // Combined full name column
        const fullNameIdx = headers.findIndex(h => {
          if (h.includes('mã')) return false;
          if (h.includes('phụ huynh')) return false;
          return h.includes('họ và tên') || h.includes('họ tên') || (h.includes('tên') && h.includes('học sinh'));
        });

        const genderIdx = headers.findIndex(h => h.includes('giới tính') || h.includes('phái') || h === 'nam/nữ');
        const dobIdx = headers.findIndex(h => h.includes('ngày sinh') || h.includes('năm sinh') || h.includes('sinh') || h === 'dob');
        const parentIdx = headers.findIndex(h => h.includes('phụ huynh') || h.includes('cha') || h.includes('mẹ') || h.includes('người giám hộ'));
        const phoneIdx = headers.findIndex(h => h.includes('sđt') || h.includes('điện thoại') || h.includes('phone') || h.includes('liên hệ'));
        const addrIdx = headers.findIndex(h => h.includes('địa chỉ') || h.includes('nơi ở') || h.includes('thường trú'));
        const notesIdx = headers.findIndex(h => h.includes('ghi chú') || h.includes('chức vụ'));

        const students: Array<Partial<Student>> = [];
        for (let i = headerRowIdx + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          let fullName = '';
          if (hoDemIdx >= 0 && tenIdx >= 0 && (row[hoDemIdx] || row[tenIdx])) {
            const ho = String(row[hoDemIdx] || '').trim();
            const ten = String(row[tenIdx] || '').trim();
            fullName = `${ho} ${ten}`.trim();
          } else if (fullNameIdx >= 0 && row[fullNameIdx]) {
            fullName = String(row[fullNameIdx]).trim();
          } else if (tenIdx >= 0 && row[tenIdx]) {
            fullName = String(row[tenIdx]).trim();
          }

          // If still no name, check if any cell looks like a full name (not a pure number or date)
          if (!fullName) {
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim();
              if (val.length >= 4 && !/^\d+$/.test(val) && !val.includes('/') && !val.includes('-')) {
                // If it contains a space and letters, likely a name
                if (val.includes(' ') && /[a-zA-ZÀ-ỹ]/.test(val)) {
                  fullName = val;
                  break;
                }
              }
            }
          }

          let code = codeIdx >= 0 && row[codeIdx] ? String(row[codeIdx]).trim() : '';
          let birthdate = dobIdx >= 0 && row[dobIdx] ? String(row[dobIdx]).trim() : '';
          const gender = genderIdx >= 0 && row[genderIdx] 
            ? (String(row[genderIdx]).toLowerCase().includes('nữ') ? 'Nữ' : 'Nam') 
            : 'Nam';

          // Format birthdate cleanly
          if (birthdate) {
            if (birthdate.includes('-')) {
              const parts = birthdate.split('-');
              if (parts.length === 3 && parts[0].length === 4) {
                // yyyy-mm-dd -> dd/mm/yyyy
                birthdate = `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
              }
            } else if (/^\d{8}$/.test(birthdate)) {
              // ddmmyyyy -> dd/mm/yyyy
              birthdate = `${birthdate.slice(0, 2)}/${birthdate.slice(2, 4)}/${birthdate.slice(4)}`;
            }
          }

          // If code is missing or same as STT (1, 2, 3), try to make a friendly student code or use birthdate
          if (!code || code === 'undefined') {
            const cleanDob = (birthdate || '').replace(/\D/g, '');
            code = cleanDob.length === 8 ? cleanDob : `HS${String(students.length + 1).padStart(3, '0')}`;
          }

          if (fullName && !/^\d+$/.test(fullName)) {
            students.push({
              code,
              fullName,
              gender: gender as 'Nam' | 'Nữ',
              birthdate: birthdate || '01/01/2013',
              parentName: parentIdx >= 0 ? String(row[parentIdx] || '').trim() : '',
              parentPhone: phoneIdx >= 0 ? String(row[phoneIdx] || '').trim() : '',
              address: addrIdx >= 0 ? String(row[addrIdx] || '').trim() : '',
              notes: notesIdx >= 0 ? String(row[notesIdx] || '').trim() : '',
            });
          }
        }
        resolve(students);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Đọc tệp thất bại.'));
    reader.readAsArrayBuffer(file);
  });
}

// 3. Export Student List to Excel
export function exportStudentList(students: Student[], settings: ClassSettings) {
  const rows: any[][] = [
    [`TRƯỜNG: ${settings.schoolName || '---'}`],
    [`LỚP: ${settings.className} - NĂM HỌC: ${settings.academicYear}`],
    [`GIÁO VIÊN CHỦ NHIỆM: ${settings.homeroomTeacher}`],
    [`DANH SÁCH HỌC SINH`],
    [],
    ['STT', 'Mã hồ sơ', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Họ tên PH', 'SĐT Phụ huynh', 'Địa chỉ', 'Ghi chú'],
  ];

  students.forEach((s, idx) => {
    rows.push([
      idx + 1,
      s.code,
      s.fullName,
      s.gender,
      s.birthdate,
      s.parentName || '',
      s.parentPhone || '',
      s.address || '',
      s.notes || '',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 10 },
    { wch: 14 },
    { wch: 20 },
    { wch: 15 },
    { wch: 25 },
    { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách lớp');
  downloadWorkbook(wb, `Danh_Sach_${settings.className}_${settings.academicYear}.xlsx`);
}

// 4. Download Gradebook Template
export function downloadGradebookTemplate(students: Student[], subjects: Subject[], monthName: string) {
  const gradedSubjects = subjects.filter(s => s.isGraded);
  const headers = ['STT', 'Mã hồ sơ', 'Họ và tên', ...gradedSubjects.map(s => s.name)];

  const rows: any[][] = [headers];
  students.forEach((s, idx) => {
    rows.push([idx + 1, s.code, s.fullName, ...gradedSubjects.map(() => '')]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 15 }, { wch: 25 }, ...gradedSubjects.map(() => ({ wch: 12 }))];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Bang_Diem_${monthName}`);
  downloadWorkbook(wb, `Mau_Bang_Diem_${monthName}.xlsx`);
}

// 5. Parse Gradebook Excel
export function parseGradebookExcel(file: File, subjects: Subject[]): Promise<{
  grades: Record<string, Record<string, number | null>>; // studentCode -> { subjectCode: score }
  errors: string[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

        if (rawJson.length < 2) {
          throw new Error('Tệp không có dữ liệu bảng điểm.');
        }

        const headers = rawJson[0].map((h: any) => String(h || '').trim());
        const codeIdx = headers.findIndex(h => h.toLowerCase().includes('mã'));
        if (codeIdx === -1) {
          throw new Error('Không tìm thấy cột "Mã hồ sơ" trong file Excel.');
        }

        // Map column index to subject
        const colSubjectMap: Record<number, Subject> = {};
        headers.forEach((h, colIdx) => {
          const matchSub = subjects.find(
            s => s.name.toLowerCase() === h.toLowerCase() || s.code.toLowerCase() === h.toLowerCase()
          );
          if (matchSub && matchSub.isGraded) {
            colSubjectMap[colIdx] = matchSub;
          }
        });

        const grades: Record<string, Record<string, number | null>> = {};
        const errors: string[] = [];

        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const studentCode = String(row[codeIdx] || '').trim();
          if (!studentCode) continue;

          grades[studentCode] = {};

          for (const [colIdxStr, sub] of Object.entries(colSubjectMap)) {
            const colIdx = Number(colIdxStr);
            const val = row[colIdx];
            if (val === undefined || val === null || String(val).trim() === '' || String(val).trim() === '-') {
              grades[studentCode][sub.code] = null;
            } else {
              // Replace comma with dot e.g. "8,5" -> "8.5"
              const cleanedVal = String(val).replace(',', '.').trim();
              const num = parseFloat(cleanedVal);
              if (isNaN(num) || num < 0 || num > 10) {
                errors.push(`Dòng ${i + 1} (${studentCode}): Điểm môn ${sub.name} "${val}" không hợp lệ (phải từ 0 đến 10).`);
              } else {
                grades[studentCode][sub.code] = Math.round(num * 100) / 100;
              }
            }
          }
        }

        resolve({ grades, errors });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Đọc tệp điểm thất bại.'));
    reader.readAsArrayBuffer(file);
  });
}

// 6. Export Monthly Gradebook to Excel
export function exportGradebookExcel(
  students: Student[],
  subjects: Subject[],
  monthGrades: Record<string, Record<string, number | null>>,
  monthName: string,
  settings: ClassSettings
) {
  const gradedSubjects = subjects.filter(s => s.isGraded);
  const rows: any[][] = [
    [`TRƯỜNG: ${settings.schoolName || '---'}`],
    [`LỚP: ${settings.className} - NĂM HỌC: ${settings.academicYear}`],
    [`GIÁO VIÊN CHỦ NHIỆM: ${settings.homeroomTeacher}`],
    [`BẢNG ĐIỂM HỌC TẬP - ${monthName.toUpperCase()}`],
    [],
    ['STT', 'Mã hồ sơ', 'Họ và tên', ...gradedSubjects.map(s => s.name), 'ĐTB Tháng'],
  ];

  students.forEach((s, idx) => {
    const studentScores = monthGrades[s.id] || {};
    let sum = 0;
    let count = 0;

    const scoreCells = gradedSubjects.map(sub => {
      const score = studentScores[sub.code];
      if (score !== undefined && score !== null) {
        sum += score;
        count++;
        return score;
      }
      return '';
    });

    const gpa = count > 0 ? (sum / count).toFixed(2) : '';
    rows.push([idx + 1, s.code, s.fullName, ...scoreCells, gpa]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    ...gradedSubjects.map(() => ({ wch: 12 })),
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, monthName);
  downloadWorkbook(wb, `Bang_Diem_${monthName}_Lop_${settings.className}.xlsx`);
}

// 7. EXPORT VIOLATIONS EXCEL FOR SINGLE STUDENT (Requirement 9: EXACT 2 SHEETS)
export function exportStudentViolationsExcel(
  student: Student,
  incidents: Incident[],
  periodLabel: string,
  settings: ClassSettings
) {
  // Filter only violations (points < 0 or type === 'violation')
  const violations = incidents.filter(i => i.studentId === student.id && (i.type === 'violation' || i.points < 0));

  // --- Sheet 1: "Chi tiết vi phạm" ---
  const detailRows: any[][] = [
    [`TRƯỜNG: ${settings.schoolName || '---'}`],
    [`LỚP: ${settings.className} - NĂM HỌC: ${settings.academicYear}`],
    [`GIÁO VIÊN CHỦ NHIỆM: ${settings.homeroomTeacher}`],
    [`BÁO CÁO CHI TIẾT VI PHẠM KỶ LUẬT & NỀ NẾP`],
    [`Học sinh: ${student.fullName} | Mã hồ sơ: ${student.code} | Kỳ báo cáo: ${periodLabel}`],
    [],
    ['STT', 'Ngày xảy ra', 'Tên lỗi', 'Nội dung chi tiết', 'Điểm trừ', 'Ghi chú', 'Người ghi nhận'],
  ];

  violations.forEach((v, idx) => {
    detailRows.push([
      idx + 1,
      v.date,
      v.ruleName,
      v.content || '',
      Math.abs(v.points),
      v.notes || '',
      v.recordedBy || settings.homeroomTeacher,
    ]);
  });

  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  wsDetail['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 25 },
    { wch: 35 },
    { wch: 12 },
    { wch: 25 },
    { wch: 20 },
  ];

  // --- Sheet 2: "Tổng hợp theo lỗi" ---
  const errorMap: Record<string, { count: number; totalPenalty: number }> = {};
  violations.forEach(v => {
    const key = v.ruleName || 'Lỗi nề nếp khác';
    if (!errorMap[key]) {
      errorMap[key] = { count: 0, totalPenalty: 0 };
    }
    errorMap[key].count += 1;
    errorMap[key].totalPenalty += Math.abs(v.points);
  });

  const summaryRows: any[][] = [
    [`TRƯỜNG: ${settings.schoolName || '---'}`],
    [`LỚP: ${settings.className} - NĂM HỌC: ${settings.academicYear}`],
    [`BẢNG TỔNG HỢP THEO LỖI VI PHẠM`],
    [`Học sinh: ${student.fullName} (${student.code}) - ${periodLabel}`],
    [],
    ['STT', 'Tên lỗi vi phạm', 'Số lượt vi phạm', 'Tổng điểm trừ'],
  ];

  let stt = 1;
  let totalCount = 0;
  let grandPenalty = 0;

  for (const [errorName, stat] of Object.entries(errorMap)) {
    summaryRows.push([stt++, errorName, stat.count, stat.totalPenalty]);
    totalCount += stat.count;
    grandPenalty += stat.totalPenalty;
  }

  summaryRows.push([]);
  summaryRows.push(['', 'TỔNG CỘNG', totalCount, grandPenalty]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 18 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi tiết vi phạm');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng hợp theo lỗi');

  downloadWorkbook(wb, `Vi_Pham_${student.code}_${student.fullName.replace(/\s+/g, '_')}.xlsx`);
}

// 8. Export Class Emulation Report
export function exportClassEmulationExcel(
  students: Student[],
  incidents: Incident[],
  settings: ClassSettings,
  emulationSettings: { startingScore: number; thresholdGood: number; thresholdFair: number; thresholdPass: number },
  periodLabel: string
) {
  const rows: any[][] = [
    [`TRƯỜNG: ${settings.schoolName || '---'}`],
    [`LỚP: ${settings.className} - NĂM HỌC: ${settings.academicYear}`],
    [`GIÁO VIÊN CHỦ NHIỆM: ${settings.homeroomTeacher}`],
    [`BÁO CÁO THI ĐUA & RÈN LUYỆN TOÀN LỚP - ${periodLabel.toUpperCase()}`],
    [],
    ['STT', 'Mã hồ sơ', 'Họ và tên', 'Điểm khởi đầu', 'Tổng điểm cộng', 'Tổng điểm trừ', 'Điểm thi đua còn lại', 'Xếp loại'],
  ];

  students.forEach((s, idx) => {
    const studentIncs = incidents.filter(i => i.studentId === s.id);
    const bonus = studentIncs.filter(i => i.points > 0).reduce((acc, cur) => acc + cur.points, 0);
    const penalty = studentIncs.filter(i => i.points < 0).reduce((acc, cur) => acc + Math.abs(cur.points), 0);
    const finalScore = emulationSettings.startingScore + bonus - penalty;

    let rank = 'Chưa đạt';
    if (finalScore >= emulationSettings.thresholdGood) rank = 'Tốt';
    else if (finalScore >= emulationSettings.thresholdFair) rank = 'Khá';
    else if (finalScore >= emulationSettings.thresholdPass) rank = 'Đạt';

    rows.push([idx + 1, s.code, s.fullName, emulationSettings.startingScore, bonus, penalty, finalScore, rank]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 25 },
    { wch: 14 },
    { wch: 15 },
    { wch: 15 },
    { wch: 20 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Thi đua cả lớp');
  downloadWorkbook(wb, `Thi_Dua_${settings.className}_${periodLabel}.xlsx`);
}
