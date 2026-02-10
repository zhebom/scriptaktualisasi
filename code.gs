// Konfigurasi
const TELEGRAM_TOKEN = "################"; // Ganti dengan token bot anda
// const SHEET_URL = "#################";
 const GEMINI_API_KEY = "##########################";
// const SHEET_NAME = "sheet1";
const SHEET_OCR = "sheet1";
const SHEET_URL2="########################";
function doGet() {
  
  return ContentService.createTextOutput("Bot Telegram Active. Developed By Widhiawan Agung Kusumo");
}

function doPost(e) {
  try {
    let contents = JSON.parse(e.postData.contents);
    let message = contents.message || contents.edited_message;
    if (!message) return;

    let chatId = message.chat.id;

    // JIKA USER MENGIRIM FOTO
    if (message.photo) {
      kirimPesanTelegram(chatId, "Jarvis sedang membaca gambar Anda, mohon tunggu...");
      let fileId = message.photo[message.photo.length - 1].file_id; // Ambil resolusi tertinggi
      let hasilOCR = prosesOCR(fileId);
      return kirimPesanTelegram(chatId, hasilOCR);
    }

    // JIKA USER MENGIRIM TEKS
    if (message.text) {
      let senderMessage = message.text;
      
      if (senderMessage.toLowerCase().includes("jarvis")) {
        let aiResponse = panggilGeminiRekap(senderMessage);
        return kirimPesanTelegram(chatId, aiResponse);
      } 
      
      // if (senderMessage.toLowerCase().includes("daftar")) {
      //   let result = inputGsheet(senderMessage);
      //   return kirimPesanTelegram(chatId, result);
      // }
    }

  } catch (err) {
    Logger.log("Error: " + err.toString());
  }
}

// ===== Fungsi Kirim Balasan ke Telegram =====
function kirimPesanTelegram(chatId, text) {
  let url = "https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage";
  let payload = {
    "chat_id": chatId,
    "text": text,
    "parse_mode": "Markdown"
  };
  let options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  return UrlFetchApp.fetch(url, options);
}

// ===== Function input google sheet ====//
// function inputGsheet(senderMessage) {
//   let file = SpreadsheetApp.openByUrl(SHEET_URL);
//   let sheet = file.getSheetByName(SHEET_NAME);
  
//   // Mengurai isi pesan berdasarkan enter atau titik dua
//   let parsedMessage = senderMessage
//     .split(/[\r\n:]+/)
//     .map(item => item.trim())
//     .filter(item => item !== ""); 
  
//   try {
//     let namaProyek = parsedMessage[2] || "-";
//     let namaOwner  = parsedMessage[4] || "-";
//     let nominal    = parsedMessage[6] || "0";
//     let tanggal    = parsedMessage[8] || "-";
//     let bayar      = parsedMessage[10] || "-";
//     let buktiTf    = parsedMessage[12] || "-";

//     let row = sheet.getLastRow() + 1;
//     let prefixIdPendaftar = 220000;
//     let idPendaftar = `A-${prefixIdPendaftar + row - 1}`;

//     sheet.appendRow([idPendaftar, namaProyek, namaOwner, nominal, tanggal, bayar, buktiTf]);

//     return `✅ *Pendaftaran Berhasil*\n\nID: ${idPendaftar}\nOwner: ${namaOwner}\nStatus: ${bayar}`;
//   } catch (e) {
//     return "❌ Gagal memproses format pendaftaran.";
//   }
// }

function convertSheetToJson() {
  const ss = SpreadsheetApp.openByUrl(SHEET_URL2);
  const sheet = ss.getSheetByName(SHEET_OCR); // Pastikan nama sheet benar
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return "Data sheet kosong.";

  const headers = data[0];
  const rows = data.slice(1);

  const jsonArray = rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });

  return JSON.stringify(jsonArray);
}

function panggilGeminiRekap(senderMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    "contents": [{
      "parts": [{
        "text": "Data Sheet: " + convertSheetToJson() + "\n\nUser Question: " + senderMessage
      }]
    }]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());

    //return JSON.stringify(json);
    let rawReply = json.candidates[0].content.parts[0].text;
    //return console.log(rawReply);
    return rawReply
      .replace(/\*/g, "") // Menghapus asterisk untuk text bersih, atau biarkan jika ingin format bold telegram
      .trim();
      
  } catch (e) {
    //console.log("Maaf Jarvis sedang mengalami gangguan koneksi ke otak AI.");
    //return JSON.stringify(senderMessage);
    return "Maaf Jarvis sedang mengalami gangguan koneksi ke otak AI.";
  }

  
}
function prosesOCR(fileId) 
  {
  // 1. Ambil File Path dari Telegram
  let getFileUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`;
  let fileResponse = JSON.parse(UrlFetchApp.fetch(getFileUrl).getContentText());
  let filePath = fileResponse.result.file_path;
  let imageUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${filePath}`;

  // 2. Download gambar sebagai Blob
  let imageBlob = UrlFetchApp.fetch(imageUrl).getBlob();
  let base64Image = Utilities.base64Encode(imageBlob.getBytes());

  // 3. Kirim ke Gemini 2.5 Flash
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    "contents": [{
      "parts": [
        {"text": "Ekstrak data dari gambar sampul buku dan kategorikan dewey decimal number(DDC). Berikan jawaban dalam format JSON mentah saja tanpa markdown : {\"judul\": \"...\",\"pengarang\": \"...\", \"kota\": \"...\", \"penerbit\": \"...\", \"tahun\": \"...\",\"isbn\": \"...\",\"ddc\": \"...\"}"},
        {
          "inline_data": {
            "mime_type": "image/jpeg",
            "data": base64Image
          }
        }
      ]
    }]
  };

  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    let jsonString = result.candidates[0].content.parts[0].text.replace(/```json|```/g, "");
    let data = JSON.parse(jsonString);
    
    // 4. Input ke Google Sheet
    let ss = SpreadsheetApp.openByUrl(SHEET_URL2);
    let sheet = ss.getSheetByName(SHEET_OCR) || ss.getSheets()[0];
    sheet.appendRow([new Date(),data.judul, data.pengarang, data.kota, data.penerbit, data.tahun, data.isbn,data.ddc]);

    return `✅ Data Berhasil dikonversi!\nJudul Buku : ${data.judul}\nNama Pengarang : ${data.pengarang}\nKota Terbit:${data.kota}\nPenerbit: ${data.penerbit} \nISBN= ${data.isbn}\nDDC= ${data.ddc}\nData telah dicatat di Google Sheet.`;
  } catch (e) {
    return "❌ Gagal memproses gambar. Pastikan gambar jelas.";
  }
}
