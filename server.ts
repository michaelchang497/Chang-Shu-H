import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { mockPatients } from "./src/data/patientData.js"; // Use JS extension in ESM imports if needed, or ts

dotenv.config();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Storage for saved education sessions (in-memory)
const sessionStore: Record<string, any> = {};

// ==========================================
// HIGH-FIDELITY LOCAL CLINICAL FALLBACK GENERATORS (OFFLINE / SAFE-MODE)
// ==========================================

function getLocalPatientAnalyze(patient: any) {
  const currentLab = patient.labHistory[patient.labHistory.length - 1];
  const firstLab = patient.labHistory[0];
  
  // Decide abnormal items dynamically
  const abnormalItems: any[] = [];
  
  if (currentLab.hba1c > 6.0) {
    abnormalItems.push({
      item: `糖化血色素 (${currentLab.hba1c}%)`,
      value: `${currentLab.hba1c}%`,
      reference: "4.0 - 6.0%",
      status: currentLab.hba1c >= 8.0 ? "danger" : "high",
      insight: `患者最新糖化血色素為 ${currentLab.hba1c}%，顯著高於正常參考值。長期血糖及糖雙重毒性會促使進階糖化終產物 (AGEs) 沉積，造成腎絲球足細胞基底膜微小血管發生硬化與發炎損傷。`
    });
  }
  
  if (currentLab.egfr < 90) {
    abnormalItems.push({
      item: `腎絲球過濾率 eGFR (${currentLab.egfr} mL/min/1.73m²)`,
      value: `${currentLab.egfr}`,
      reference: "≥ 90 mL/min",
      status: currentLab.egfr < 45 ? "danger" : "low",
      insight: `當前腎小球過濾率衰退至 ${currentLab.egfr}，確診進入慢性腎臟病 (CKD) 第 ${currentLab.egfr < 30 ? '4' : currentLab.egfr < 60 ? '3' : '2'} 期。排毒功能實質滑落，需啟動精準膳食控制以保全剩餘腎元。`
    });
  }
  
  if (currentLab.uacr > 30) {
    abnormalItems.push({
      item: `尿微量白蛋白/肌酸酐比 UACR (${currentLab.uacr} mg/g)`,
      value: `${currentLab.uacr} mg/g`,
      reference: "< 30 mg/g",
      status: currentLab.uacr >= 300 ? "danger" : "high",
      insight: `UACR 升至 ${currentLab.uacr} mg/g，呈現${currentLab.uacr >= 300 ? '顯著大量蛋白尿' : '微量白蛋白尿'}，確認腎臟網膜半透膜通透性及分子電荷屏障已受損，需立即限制鈉鹽與防堵過度蛋白質產生的尿毒超載。`
    });
  }

  if (currentLab.fastingGlucose > 100) {
    abnormalItems.push({
      item: `空腹血糖 (${currentLab.fastingGlucose} mg/dL)`,
      value: `${currentLab.fastingGlucose} mg/dL`,
      reference: "70 - 100 mg/dL",
      status: currentLab.fastingGlucose > 140 ? "danger" : "high",
      insight: `空腹血糖高達 ${currentLab.fastingGlucose} mg/dL，呈現長期高血糖與重度胰島素阻抗，全身內皮細胞持續發炎，持續加深末梢血管硬化比重。`
    });
  }

  const isFemale = patient.gender === 'F';
  if (currentLab.creatinine > 1.2 || (isFemale && currentLab.creatinine > 1.1)) {
    abnormalItems.push({
      item: `血清肌酸酐 Creatinine (${currentLab.creatinine} mg/dL)`,
      value: `${currentLab.creatinine} mg/dL`,
      reference: isFemale ? "0.5 - 1.1 mg/dL" : "0.7 - 1.4 mg/dL",
      status: "high",
      insight: `血清肌酸酐處於上升波動，反映體內氮代謝廢物堆積情形，與 eGFR 之退化進程相符。`
    });
  }

  // Choose recommended topics based on clinical parameters
  const recommendedTopics: any[] = [];
  if (currentLab.uacr > 30 || currentLab.egfr < 60) {
    recommendedTopics.push({
      id: "diet_sodium",
      category: "diet",
      title: "限鈉低鹽料理配餐防禦",
      description: "每日食鹽限制在 5 公克（鈉 2000 毫克）以下。杜絕加工醬料、罐頭及醃漬零配菜，阻斷高灌注血壓對腎絲球小血管網的微破壞。"
    });
    
    if (currentLab.egfr < 45) {
      recommendedTopics.push({
        id: "kidney_lowpro",
        category: "kidney_care",
        title: "嚴格低蛋白與低氮澱粉搭配法",
        description: `當腎排毒機能減低至 ${currentLab.egfr} 階段，多餘蛋白質會在體內轉換為高量含氮毒素。每日蛋白质限制在 0.6g/kg 理想體重。主食應以米粉、冬粉、西谷米或低氮澄粉部分取代普通米飯。`
      });
    } else {
      recommendedTopics.push({
        id: "kidney_protein",
        category: "kidney_care",
        title: "蛋白質總額適量控制與高生理蛋白",
        description: "早期糖腎階段，將全天蛋白質控額至 0.8g/kg 理想體重。餐桌多選用雞蛋、熟豆腐、淡魚肉，減少攝取麵筋加工肉類及豆輪等非精質蛋白。"
      });
    }
  } else {
    recommendedTopics.push({
      id: "diet_carb",
      category: "diet",
      title: "醣類比例調控與總克數定時配膳",
      description: "規律定額碳水化合物主食（如每餐 2/3 碗十穀飯），全力戒除黑糖、手搖杯茶飲及甜食等精緻含糖加工料，減少胰腺疲乏震盪。"
    });
  }

  if (currentLab.egfr < 45) {
    recommendedTopics.push({
      id: "diet_potassium",
      category: "diet",
      title: "限鉀竅門：蔬菜烹調前大火滾水川燙",
      description: "避免體內鉀離子高積導致心律不整。所有綠色青菜在拌炒前，必須切細小段，置入大火熱水滾沸川燙 3~5 分鐘，將含鉀燙汁倒去才可油拌料理。"
    });
    recommendedTopics.push({
      id: "diet_phosphorus",
      category: "diet",
      title: "限磷策略：謝絕含發酵酵母及高磷加工食材",
      description: "腎衰竭高排磷受限，過量磷會導致血管鈣化與嚴重的骨病變。禁忌內臟、養生堅果、重度乳酪、酵母粉吐司麵包與碳酸可樂。用餐須常規咀嚼磷結合劑。"
    });
  } else {
    recommendedTopics.push({
      id: "lifestyle_exercise",
      category: "lifestyle",
      title: "中等活動度有氧運動燃脂甩阻抗",
      description: "支持每星期進行 150 分鐘的中等強度有氧運動（例如健走、安全功率單車），能高比例降解內臟及脂肪肝累積，提升細胞對游離胰島素之親和度。"
    });
    recommendedTopics.push({
      id: "medication_sglt2",
      category: "medication",
      title: "糖腎首選 SGLT2i 抑制劑規律服用配合",
      description: "配合主責醫師服用新型排糖藥物，此類藥物在尿液排尿醣之餘，亦能調控腎絲球內入球小動脈壓、減少微蛋白滲漏，為慢病保護心腎明星藥物。"
    });
  }

  // Add at least one lifestyle topic dynamically
  recommendedTopics.push({
    id: "lifestyle_measure",
    category: "lifestyle",
    title: "每日血糖配對量測與小腿指壓水腫查驗",
    description: "每日記錄清晨及晚間量測血壓值。另外，洗澡前用手指按壓足背或小腿內踝 5 秒，自主檢閱有無一壓凹陷難以回彈的異常水腫積水警訊。"
  });

  const a1cDiff = (currentLab.hba1c - firstLab.hba1c).toFixed(1);
  const a1cTrendStr = parseFloat(a1cDiff) > 0 
    ? `糖化血色素自先前之 ${firstLab.hba1c}% 攀升至最新之 ${currentLab.hba1c}%（累積彈升 ${a1cDiff}%），反映近期在主食碳水、點心水果糖分管理上存在明顯的代謝失償，胰島代償機制趨向過荷運作。`
    : `糖化血色素自先前之 ${firstLab.hba1c}% 微幅調降至最新之 ${currentLab.hba1c}%，顯示前期口服調整或生活限糖取得局部正向進度，下階段仍需著重於減少空腹血糖震幅。`;

  const egfrDiff = (firstLab.egfr - currentLab.egfr).toFixed(0);
  const egfrTrendStr = parseFloat(egfrDiff) > 0
    ? `腎絲球過濾率 eGFR 持續下滑（從先前 ${firstLab.egfr} 降至最新 ${currentLab.egfr} mL/min/1.73m²，共衰退 ${egfrDiff} 單位），代表慢性腎病程正朝 CKD 慢性腎小球過濾第 ${currentLab.egfr < 30 ? '4' : '3'} 期中期深度探底。需提早藉由低氮膳食介入，減少含氮廢物對剩餘腎元的超濾過破壞。`
    : `eGFR 指標依然維控於 ${currentLab.egfr} mL/min 平台，雖控制了衰退斜率，但由於起點微蛋白排泄未減，仍然要加緊限鈉限鹽調理。`;

  const kidneyTrendStr = currentLab.uacr > firstLab.uacr
    ? `尿白蛋白比值 UACR 自先前 ${firstLab.uacr} mg/g 大幅飆升至最新之 ${currentLab.uacr} mg/g，高度確認腎絲球基底半透膜微血管内皮通透性在糖毒性與灌注壓複合打擊下正發生足小突撕裂。此指標與血清肌酸酐上揚至 ${currentLab.creatinine} mg/dL 的軌跡十分吻合，必須立即防化。`
    : `尿白蛋白維持在 ${currentLab.uacr} mg/g 軌跡，反映已有微量至中度滲漏。雖然有小幅度修補，但務必伴隨血壓控制在 130/80 mmHg 以下，以保基底膜完全修復。`;

  const glucoseTrendStr = `最新空腹血糖錄得 ${currentLab.fastingGlucose} mg/dL，波動水平高度異常。餐後胰島素反調節機制衰退。多餘血糖會產生強烈的內皮氧化應激，臨床上應積極介入规配飲食與口服藥協調。`;

  const generalAssessment = `本案個案確診糖尿病並高度伴隨${currentLab.egfr < 60 ? '慢性腎病變第三期' : '早期糖尿病腎病變'}。近期生化軌跡呈急遽反彈，尤以 UACR 白蛋白通透度上升與過濾率下降發出強烈橙色警戒。體位指標 (BMI ${patient.bmi}) 屬控餐死角。彰秀多科融合團隊急推實施超優質低膳蛋白質比例、徹底限鹽、遵守每日青菜川燙去鉀，並配對血壓、小腿指壓積水監管，協同胰島素與排糖配合，拉平血糖與腎絲球血管基膜高內壓，全力護航剩餘腎功能。`;

  return {
    abnormalItems,
    recommendedTopics,
    a1cTrendInterpretation: a1cTrendStr,
    egfrTrendInterpretation: egfrTrendStr,
    kidneyInterpretation: kidneyTrendStr,
    glucoseInterpretation: glucoseTrendStr,
    generalAssessment
  };
}

function getLocalPatientAnalyzeNutrition(patient: any) {
  const currentLab = patient.labHistory[patient.labHistory.length - 1];
  
  // Decide ideal weight and dietary gradients
  const idealWeight = parseFloat(((patient.height / 100) ** 2 * 22).toFixed(1));
  const calorieBase = Math.round(idealWeight * 25);
  const calorieHigh = Math.round(idealWeight * 30);
  let proteinRatio = "";
  let proteinGrams = "";
  
  if (currentLab.egfr >= 60) {
    proteinRatio = "0.8 ~ 1.0 g/kg (適量蛋白質控管)";
    proteinGrams = `${Math.round(idealWeight * 0.8)} ~ ${Math.round(idealWeight * 1.0)} 克/天`;
  } else if (currentLab.egfr >= 30 && currentLab.egfr < 60) {
    proteinRatio = "0.6 ~ 0.8 g/kg (低蛋白護腎膳食)";
    proteinGrams = `${Math.round(idealWeight * 0.6)} ~ ${Math.round(idealWeight * 0.8)} 克/天`;
  } else {
    proteinRatio = "0.6 g/kg (嚴格極低蛋白膳食限制)";
    proteinGrams = `${Math.round(idealWeight * 0.6)} 克/天 (嚴防高血磷與血鉀過載)`;
  }

  const bmiEvaluation = `個案身高為 ${patient.height} cm、體重 ${patient.weight} kg，身體質量指數 BMI 為 ${patient.bmi}（本院體位判定：${patient.bmi >= 27 ? '輕度肥胖，且脂質肌肉屏障有潛在流失風險' : patient.bmi >= 24 ? '體重過重' : '標準體位'}）。理想體重 (IBW) 為 ${idealWeight} kg，全日極限基礎與日常活動總能量攝取建議為 ${calorieBase} ~ ${calorieHigh} kcal。應嚴格防止肌少肥胖狀態持續惡化。`;

  const metabolicAssessment = `最新生化報告顯示糖化血色素 HbA1c 高達 ${currentLab.hba1c}%、空腹血糖達 ${currentLab.fastingGlucose} mg/dL，伴隨腎排毒指標 eGFR 限縮至 ${currentLab.egfr} mL/min、尿蛋白比值 UACR 突破至 ${currentLab.uacr} mg/g。此臨床特徵充分印證體內高濃度血糖的微血管發炎損傷，亦直接加劇腎絲球小動脈的高灌注與高過濾內壓。為減低多餘尿毒廢物於血中滯留，極需精細調節每日蛋白質比重並嚴抓鈉鹽和精緻主食限制。`;

  const dateStr = new Date().toISOString().split('T')[0];
  const adimeDraft = `【彰秀醫院 臨床營養專門照護紀錄 (ADIME 格式) 正式報告草稿】
評估日期：${dateStr}  |  主責營養師：專科臨床營養小組  |  病卡案號：${patient.id}
個案姓名：${patient.name} (${patient.gender === 'M' ? '男' : '女'}，${patient.age} 歲)
臨床診斷：${patient.diagnosis}
---------------------------------------------------------
[A] Assessment (臨床營養與代謝評估)
1. 體位量測 (Anthropometric): 
   - 身高：${patient.height} cm  |  體重：${patient.weight} kg  |  BMI：${patient.bmi} (判定：體脂過高)
   - 理想體重 (IBW)：${idealWeight} kg  |  熱量建議調配區間：${calorieBase} ~ ${calorieHigh} 大卡/日 (以 25~30 kcal/kg IBW 估計)
2. 生化指標 (Biochemical): 
   - 代謝分析：空腹血糖 ${currentLab.fastingGlucose} mg/dL、糖化血色素 HbA1c ${currentLab.hba1c}% (控糖明顯失代償)
   - 腎臟代謝：血清肌酸酐 ${currentLab.creatinine} mg/dL、eGFR 腎過濾率 ${currentLab.egfr} mL/min/1.73m² (進入慢性腎臟病第三期段)
   - 尿白蛋白：UACR 尿蛋白 ${currentLab.uacr} mg/g (微細血管受損滲漏中)
3. 飲食生活型態 (Dietary): 
   - 晤談顯示患者日常主食普通碳水比重過載，且經常在正餐以外攝入高脂肪或高鈉小點心。蛋白質攝取不自覺超量（如外食便當大塊排骨和加工肉製品）。

[D] Diagnosis (營養 PES 專門診斷)
1. 蛋白質攝取過高 (NI-5.7.1)：因平日外食肉類份數過多，與腎臟排毒過濾率下降不符，顯現產品於最新 eGFR 滑落至 ${currentLab.egfr} mL/min、UACR 高達 ${currentLab.uacr} mg/g。
2. 碳水化合物/醣類主食攝取不當 (NI-5.8.2)：與餐食中主食過剩相關，顯現於糖化血色素 HbA1c 攀升至 ${currentLab.hba1c}%。

[I] Intervention (營養干預處方)
1. 蛋白質精準限量：限制全日蛋白质總量等同 ${proteinRatio}（等同每日總量為 ${proteinGrams}）。其中優質高生理價蛋白質（植物大豆、雞胸肉、雞蛋蛋白）比例必須拉高至 60% 以上。
2. 主食高氮代換：每餐普通白米或切麵的 1/3~1/2 份額，應以低氮澱粉（例如冬粉、西谷米、板條、澄粉）來取代，在不減少總熱量的前提下大幅削減非優質植物蛋白負擔，阻止尿毒堆積。
3. 高血壓防禦：日常全食材料理實施限鹽。杜絕一切沙茶醬、豆瓣醬，避免破壞足細胞屏障。

[M] Monitoring & Evaluation (監測與評估)
1. 三個月內目標空腹血糖控制於 100~130 mg/dL，HbA1c 下滑至 < 7.0%。
2. 下次回診偕同醫師重新抽血複檢 eGFR 過濾率與 UACR 蛋白尿是否下降。
3. 自主體重維持：目標一個月內排除因瀦留引起的虛重，將 BMI 優化調回。`;

  // Recommended topics
  const recommendedDietTopics: any[] = [];
  recommendedDietTopics.push({
    id: "diet_na",
    category: "diet",
    title: "限鈉低鹽控壓生活配膳",
    description: "全日食鹽限制於 5 克以內（約少於半茶匙，等同鈉 2000 毫克）。摒棄一切火鍋高湯、辣椒油膏及罐頭醃製品。多利用蒜頭、生薑等天然調料提升食物風味。"
  });

  recommendedDietTopics.push({
    id: "diet_prot",
    category: "diet",
    title: "低蛋白精準定量與低氮澱粉代換",
    description: `在 eGFR 退化至 ${currentLab.egfr} 階段，過多胺基酸在體內會轉化為嚴重氮廢物。應控制蛋白质份數（每日建議 ${proteinRatio}），正餐可用冬粉、西谷米、澄粉點心補足能量，防止尿毒及酸中毒加重。`
  });

  if (currentLab.egfr < 45) {
    recommendedDietTopics.push({
      id: "diet_p",
      category: "diet",
      title: "嚴格限磷技術（杜絕高血磷與血管鈣化）",
      description: "腎功能不全至此時，高磷食物極易堆積。請徹底戒除堅果（花生、核桃）、內臟、咖啡茶葉、全穀糙米及酵母粉發酵發粿、碳酸飲料。餐中請按規隨餐咀嚼磷結合藥劑。"
    });
    recommendedDietTopics.push({
      id: "diet_k",
      category: "diet",
      title: "安全去鉀祕訣：蔬菜一切碎、二滾燙、三倒水、四油炒",
      description: "血鉀累積是臨床心搏驟停的隱形殺手。所有深色蔬菜在料理前必須切碎，丟入大火燒開的沸水中燙煮 3~5 分鐘以上，隨即將黃色含鉀菜湯倒掉，瀝乾後再行添加橄欖油拌炒或清炒。嚴禁生菜、精力湯及香蕉楊桃釋迦！"
    });
  } else {
    recommendedDietTopics.push({
      id: "diet_carb",
      category: "diet",
      title: "主食醣類分餐與全五穀慢升糖調控",
      description: "戒絕稀飯、白吐司、蘇打餅乾與一切手搖甜飲。每餐主食以糙米飯或燕麥麥片（分餐控制約半飯碗），搭配黑木耳、高纖秋葵或洋蔥等，拉平餐後血糖與胰島素峰值。"
    });
    recommendedDietTopics.push({
      id: "diet_fat",
      category: "diet",
      title: "低飽和油脂與脂肪肝消脂配餐",
      description: "完全拒絕食用豬油、奶油、雞皮及油炸大肉排。改用冷壓橄欖油、葵花油等單元不飽和脂肪油，多清蒸、烤或水燙，降低高血脂膽固醇對血管壁形成的血栓壓力。"
    });
  }

  return {
    bmiEvaluation,
    metabolicAssessment,
    adimeDraft,
    recommendedDietTopics
  };
}

function getLocalPatientNutritionSummary(patient: any, selectedTopics: any[], nutritionistNotes: string) {
  const currentLab = patient.labHistory[patient.labHistory.length - 1];
  const pronoun = patient.gender === 'M' ? '大哥' : '阿姨';
  const nameSuffix = patient.name.slice(1);
  const displayName = `${nameSuffix}${pronoun}`;
  const notesText = nutritionistNotes ? nutritionistNotes.trim() : "請病患依處方用心控制，家屬注意蔬菜煮熟川燙，穩固回歸。";

  return `# 彰秀醫院 臨床營養專門個人化膳食處方 (Dietary Prescription)

### 敬愛的「${displayName}」與最貼心的備餐家屬：
您好！我是您的主責責任腎臟專科營養照護師。今天抽血的指標有些波動（目前糖化血色素 HbA1c 錄得 **${currentLab.hba1c}%**、腎排毒過濾率 eGFR 滑移至 **${currentLab.egfr} mL/min**，伴隨 UACR 蛋白滲漏回到 **${currentLab.uacr} mg/g**）。
雖然生化數字有些微起伏，但請您千万放寬心理包袱：這都是我們的身體在發出調整防護的積極信號！只要我們從今天起，與備餐家屬共同做好以下幾點配餐調整，就一定能將腎元小血管的發炎壓力拉回最安全的緩衝區！

---

## 一、本次門診爲您特別精編之餐桌落實計畫
${selectedTopics.map((t: any, index: number) => `### ${index + 1}. 【${t.title}】
*   **指南重點**：${t.description}
*   **營養師現場指導實踐竅門**：
    *   在正餐中請務必減少普通精緻白米和普通切麵、白吐司的總份額限制。
    *   烹飪全盤食材應當控鹽，防止大血管的二次阻力直接損壞小濾膜結構。`).join('\n\n')}

---

## 二、備餐家屬的溫馨去毒護腎巧手常識 (必讀)
1.  **「熱水川燙去鉀法」**：
    綠色蔬菜（如空心菜、大白菜、地瓜葉）內充沛的鉀離子遇到高熱極易析出。請家屬一定要將綠色青菜**洗淨切細小碎段，下油鍋前半火放入大滾水中燙煮川燙 3~5 分鐘以上**，將那大碗發黃的菜汁徹底倒掉，撈出脫鉀的蔬菜再用冷壓芥花油攪拌拌炒！這能杜絕過半的心腎高鉀負荷！
2.  **「出鍋點鹽法」**：
    為了能吃到鹹味而不超標鈉量：請炒菜時**完全不擱放鹽巴和任何醬料**。菜餚裝入白瓷盤、在熱騰騰要上桌前，再用愛心手指輕輕抓起一丁點鹽微量撒表面。這樣舌尖第一時間最快感受鹹意、然而大腦與腎臟實質攝取鹽量卻能削減 40% 以上！
3.  **杜絕內藏隱性磷**：
    不准給長輩餵食滴雞精、大骨熬湯、中藥厚燉高補，亦不要給予一切內臟、有酵素酵母粉發酵的甜點包、養生腰果芝麻糊或濃縮豆乳，以避免腎臟排磷受阻所引導的心血管鈣化硬症！

---

## 三、營養師門診特別嘱託要點
> **臨床專科營養師貼心私房札：**
> 「${notesText}」

---

## 四、我們全科照護團隊與您的暖心約定
> 「掌握餐桌上的分毫調控，不是禁錮與折磨，而是尋找最美妙美味的健康新生。彰秀多學科專科團隊隨時隨地在您手邊守護，下次回診我們一同微調比例，期待看見一個更有精神、檢驗數字天天回歸完美的您。一起努力！」

**雲端配膳二維存檔病歷編號：NUTR-${patient.id}-${Date.now().toString().slice(-6)}**
**彰秀醫院 臨床膳食營養門診 敬製**`;
}

function getLocalPatientSummary(patient: any, selectedTopics: any[], educatorNotes: string) {
  const currentLab = patient.labHistory[patient.labHistory.length - 1];
  const pronoun = patient.gender === 'M' ? '大哥' : '阿姨';
  const nameSuffix = patient.name.slice(1);
  const displayName = `${nameSuffix}${pronoun}`;
  const notesText = educatorNotes ? educatorNotes.trim() : "目前居家自我照顧指標穩定，注意量測血壓及泡泡尿變化。";

  return `# 彰秀醫院 智慧健康綜合個人化衛教指引單

### 敬愛的「${displayName}」及照護家屬：
您好！我是您在彰秀慢病管理的專責個案照護師。今天在门診我們多學科團隊和您共同審查了這陣子來的抽血檢測數字。雖然這段時間遇到了一些波折（如最新 HbA1c 為 **${currentLab.hba1c}%**、空腹血糖在 **${currentLab.fastingGlucose} mg/dL** 上移、伴隨著腎絲球 eGFR 與 UACR 指標有些許壓力變化）。

數字的暫時反彈是身體在為我們踩剎車、發送積極調整生活軌跡的警訊。在我們多專科團隊並肩抗壓的輔助下，您完全用不著焦慮，只要我們今天重新掌握以下幾項個管理程自控關鍵，就一定能拉起腎臟的安全警訊：

---

## 一、今天我們門診為您精選並完成的自管特訓大綱
${selectedTopics.map((t: any, index: number) => `### ■ ${t.title} (${t.category === 'diet' ? '正餐飲食指南' : t.category === 'kidney_care' ? '保腎護原核心' : t.category === 'medication' ? '常規常備服藥' : '自我作息調適'})
*   **衛教核心大綱**：${t.description}
*   **每日起居自控指南**：
    *   在日常作息與遵醫囑服藥上，確實落實，拉平高升糖波動，避免微血管持續缺氧發炎。`).join('\n\n')}

---

## 二、日常生活自我查驗指標三法 (護腎三步防護線)
1.  **「留意晨尿不散細泡」**：
    清晨起床的第一泡尿要特別注意！如果尿液表面覆蓋了一層像啤酒泡沫般「極細小、久久不能自動消失」的泡泡尿，常常是蛋尿通透排空加劇或足細胞正在受損，請隨時記錄或回報彰秀照護平台。
2.  **「自我按壓腿內按痕」**：
    每日洗澡或臨睡前，大拇指用力指壓按一按自己的**足背處或內側腳踝前緣** 5 秒鐘。如果按下去出現塌陷凹洞、久久不能回彈的「指壓性水腫痕跡」，常常是體內水分排泄受阻或鹽分累積。應及時調適低鹽或配合醫師複查。
3.  **「保持每日早晚量測血壓」**：
    請務必保持清晨和晚間常態量測血壓。護腎的黃金血壓防禦防護線是收縮壓低於 130 mmHg、舒氣壓在 80 mmHg 以下，這在避免微血管基底膜受二次壓力打擊中至關重要。

---

## 三、衛教師現場特別照護指引
> **個案管理師及照護團隊叮嚀手札：**
> 「${notesText}」

---

## 四、我們與您的暖心陪伴誓言
> 「慢病保全與控糖是一場不屈不撓的耐力與信心跑旅，但請您永遠記住：彰秀全體醫療（醫師、個管師、營養師、復健師）與病友會是您最溫暖安定的長跑配速伴侶！讓我們隨時回報情況，下次回診一同微笑驗證我們努力的喜悅成果！」

**本院雲端智慧衛教二維碼歸檔序號：EDU-${patient.id}-${Date.now().toString().slice(-6)}**
**彰秀醫院 多重慢性疾病多科整合中心 敬製**`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' })); // support signature images

  const PORT = 3000;

  // 1. Health check
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // 2. Search Patient Lab Reports
  app.get("/api/patient/:id", (req: Request, res: Response) => {
    const patientId = req.params.id;
    const patient = mockPatients.find(p => p.id === patientId);
    if (!patient) {
      return res.status(404).json({ error: "查無此病歷號碼。請試試範例病歷號碼：10010881、10010882 或 10010883。" });
    }
    return res.json(patient);
  });

  // 3. Analyze patient data using Gemini 3.5 Flash with strict structured JSON output
  app.post("/api/patient/analyze", async (req: Request, res: Response) => {
    const { patient } = req.body;
    if (!patient) {
      return res.status(400).json({ error: "請提供完整的病患資料項目！" });
    }

    if (!apiKey) {
      console.log("[Chang Shu Server] No GEMINI_API_KEY set, using high-fidelity local clinical analyzer.");
      const fallback = getLocalPatientAnalyze(patient);
      return res.json(fallback);
    }

    try {
      const prompt = `您是彰秀醫院的專業個案管理師與醫療AI。請深入解構以下病患並進行臨床判讀：
病歷資訊：
姓名：${patient.name}
年齡/性別：${patient.age}歲 / ${patient.gender === 'M' ? '男' : '女'}
主要診斷：${patient.diagnosis}
身高/體重/BMI：${patient.height}cm / ${patient.weight}kg / BMI ${patient.bmi}
檢驗紀錄（照時序由舊到新）：
${JSON.stringify(patient.labHistory, null, 2)}

請判讀並產生以下 JSON：
1. abnormalItems (異常項目): 比對最新一筆(Current)數值，列出異常，包含糖化血色素(HbA1c%)、腎絲球過濾率(eGFR)、微量白蛋白尿比值(UACR)、肌酸酐(Creatinine)等，標示狀態 (high/low/danger) 加註專業評語與可能之機轉。
2. recommendedTopics (推薦衛教內容): 基於異常提出至少3點本次門診首要衛教之重點項目（標題與內文，需有類別如：diet, kidney_care, lifestyle, medication）。
3. 趨勢判讀：A1C趨勢判讀、eGFR趨勢判讀、腎功能趨勢判讀、血糖控制趨勢判讀。
4. 綜合評估 (generalAssessment)。

請嚴格使用繁體中文(台灣用語)回覆，並依照指定的 JSON 格式。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a professional and emphatic AI diabetic case manager at 彰秀醫院. Use traditional Chinese (Taiwan) medical terminology (e.g., 糖化血色素, 腎絲球過濾率, 微量白蛋白尿). Ensure clinical accuracy.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              abnormalItems: {
                type: Type.ARRAY,
                description: "病理數值顯著異常的項目列表",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING, description: "檢驗項目名稱及當前數值，例如：糖化血色素 (8.3%)" },
                    value: { type: Type.STRING, description: "檢驗特定數值" },
                    reference: { type: Type.STRING, description: "臨床標準參考範圍" },
                    status: { type: Type.STRING, description: "狀態判定，必須是 'high' 、 'low' 或 'danger'" },
                    insight: { type: Type.STRING, description: "臨床機轉解讀或個人化不良反應預警" },
                  },
                  required: ["item", "value", "reference", "status", "insight"],
                }
              },
              recommendedTopics: {
                type: Type.ARRAY,
                description: "為當前病患特別推薦的個人化衛教引導項目",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "英數字小寫唯一ID，如 diet_sodium 、 kidney_protein 、 lifestyle_aerobic" },
                    category: { type: Type.STRING, description: "衛教主軸，必須為 'diet', 'medication', 'lifestyle', 或 'kidney_care'" },
                    title: { type: Type.STRING, description: "衛教單元標題" },
                    description: { type: Type.STRING, description: "該衛教單元為該病患量身訂製的教學大綱與動機引導" },
                  },
                  required: ["id", "category", "title", "description"],
                }
              },
              a1cTrendInterpretation: { type: Type.STRING, description: "針對 HbA1c 四期檢驗趨勢的專業判讀" },
              egfrTrendInterpretation: { type: Type.STRING, description: "針對 eGFR 腎功能衰退進程與慢性腎病變期數分級的深層評估" },
              kidneyInterpretation: { type: Type.STRING, description: "針對肌酸酐與 UACR 蛋白尿比值的交互惡化指標判讀" },
              glucoseInterpretation: { type: Type.STRING, description: "空腹血糖波幅與控制狀況剖析" },
              generalAssessment: { type: Type.STRING, description: "彰秀醫院衛教指導專任綜合AI評語與病患預後引導" }
            },
            required: [
              "abnormalItems",
              "recommendedTopics",
              "a1cTrendInterpretation",
              "egfrTrendInterpretation",
              "kidneyInterpretation",
              "glucoseInterpretation",
              "generalAssessment"
            ]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      
      // Defensive merging with local fallback
      const fallback = getLocalPatientAnalyze(patient);
      const finalData = {
        abnormalItems: parsedData.abnormalItems || fallback.abnormalItems,
        recommendedTopics: parsedData.recommendedTopics || fallback.recommendedTopics,
        a1cTrendInterpretation: parsedData.a1cTrendInterpretation || fallback.a1cTrendInterpretation,
        egfrTrendInterpretation: parsedData.egfrTrendInterpretation || fallback.egfrTrendInterpretation,
        kidneyInterpretation: parsedData.kidneyInterpretation || fallback.kidneyInterpretation,
        glucoseInterpretation: parsedData.glucoseInterpretation || fallback.glucoseInterpretation,
        generalAssessment: parsedData.generalAssessment || fallback.generalAssessment
      };
      res.json(finalData);
    } catch (error: any) {
      console.warn("AI Analysis Error (falling back to high-fidelity local generator):", error);
      const fallback = getLocalPatientAnalyze(patient);
      res.json(fallback);
    }
  });

  // 3b. Analyze patient nutritional status & generate ADIME Draft using Gemini 3.5 Flash
  app.post("/api/patient/analyze-nutrition", async (req: Request, res: Response) => {
    const { patient } = req.body;
    if (!patient) {
      return res.status(400).json({ error: "請提供完整的病患資料！" });
    }

    if (!apiKey) {
      console.log("[Chang Shu Server] No GEMINI_API_KEY set, using high-fidelity local clinical nutrition analyzer.");
      const fallback = getLocalPatientAnalyzeNutrition(patient);
      return res.json(fallback);
    }

    try {
      const prompt = `您是彰秀醫院的臨床專科膳食與腎臟營養師。請針對以下個案的病歷與實驗室數據進行「營養與代謝狀態分析」並產生 ADIME 照護電子紀錄：
病歷資訊：
姓名：${patient.name}
年齡/性別：${patient.age}歲 / ${patient.gender === 'M' ? '男' : '女'}
主要診斷：${patient.diagnosis}
身高/體重/BMI：${patient.height}cm / ${patient.weight}kg / BMI ${patient.bmi}
最新與歷史生化：
${JSON.stringify(patient.labHistory, null, 2)}

請判讀分析並生出以下 JSON：
1. bmiEvaluation (BMI 狀態與理想體重評估，包含肌少或過重脂度預警)。
2. metabolicAssessment (基於 A1C 血糖、腎絲球 egfr、微量白蛋白尿 uacr、肌酸酐，列出最新之代謝異常與營養問題特徵)。
3. adimeDraft: 完整包含 Assessment, Diagnosis (PES 專科診斷), Intervention, Monitoring & Evaluation 四大區段的最強專業 ADIME 格式草稿。
4. recommendedDietTopics: 提供至少 4 個專門為此患者設計之個人化膳食防線主題（包含 id, category, title, description）。例如控制鈉、低氮澱粉、低磷、限鉀或醣類克數控制。

請嚴格使用繁體中文(台灣醫學營養界常用術語)回覆，並符合規定的 JSON 格式。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an expert Chief Renal Dietitian at 彰秀醫院. Output highly professional clinical nutritional diagnosis using official Taiwanese medical terminology (e.g. 理想體重, 非優質蛋白, 低氮澱粉, 高生理價蛋白質, 磷結合劑). Keep it compact and highly evidence-based.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bmiEvaluation: { type: Type.STRING, description: "對病患身高、體重、BMI及肥胖或肌肉流失風險的評估" },
              metabolicAssessment: { type: Type.STRING, description: "基於生化報告的最新臨床代謝特徵與營養不均警語" },
              adimeDraft: { type: Type.STRING, description: "完整的、段落清晰的專業 ADIME 營養照護紀錄電子病歷草稿" },
              recommendedDietTopics: {
                type: Type.ARRAY,
                description: "營養師推薦的病患飲食衛教細部主題",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "主題代碼如 diet_na, diet_prot, diet_p, diet_carb" },
                    category: { type: Type.STRING, description: "營養衛教類別，固定為 diet" },
                    title: { type: Type.STRING, description: "飲食衛教項目標題" },
                    description: { type: Type.STRING, description: "此項生活叮嚀與彰秀日常配膳建議" }
                  },
                  required: ["id", "category", "title", "description"]
                }
              }
            },
            required: ["bmiEvaluation", "metabolicAssessment", "adimeDraft", "recommendedDietTopics"]
          }
        }
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText.trim());
      
      // Defensive merging with local fallback
      const fallback = getLocalPatientAnalyzeNutrition(patient);
      const finalData = {
        bmiEvaluation: parsedData.bmiEvaluation || fallback.bmiEvaluation,
        metabolicAssessment: parsedData.metabolicAssessment || fallback.metabolicAssessment,
        adimeDraft: parsedData.adimeDraft || fallback.adimeDraft,
        recommendedDietTopics: parsedData.recommendedDietTopics || fallback.recommendedDietTopics
      };
      res.json(finalData);
    } catch (error: any) {
      console.warn("AI Nutrition Analysis Error (falling back to high-fidelity local generator):", error);
      const fallback = getLocalPatientAnalyzeNutrition(patient);
      res.json(fallback);
    }
  });

  // 3c. Generate Personalized Nutrition Flyer Summary using Gemini
  app.post("/api/patient/generate-nutrition-summary", async (req: Request, res: Response) => {
    const { patient, selectedTopics, nutritionistNotes } = req.body;
    if (!patient || !selectedTopics) {
      return res.status(400).json({ error: "參數不足！需包含病患資料與勾選之飲食衛教主題。" });
    }

    if (!apiKey) {
      console.log("[Chang Shu Server] No GEMINI_API_KEY set, using high-fidelity local nutritionist summary generator.");
      const summary = getLocalPatientNutritionSummary(patient, selectedTopics, nutritionistNotes);
      return res.json({ summary });
    }

    try {
      const prompt = `您是彰秀醫院的專業資深臨床營養師。請為病患「${patient.name}」編彙一份「極其溫暖、醫學實證、日常容易實踐」的個人化營養與膳食處方衛教單。
病患背景：
診斷：${patient.diagnosis}
身長體重BMI：${patient.height}cm / ${patient.weight}kg / BMI ${patient.bmi} (最新指標)

營養師現場為其挑選編排的關鍵衛教單元：
${selectedTopics.map((t: any) => `- 【${t.title}】 : ${t.description}`).join("\n")}

營養師客製化飲食叮嚀：
${nutritionistNotes || "無額外特別備註"}

請將以上飲食計劃轉換為一份專門給「${patient.name}」及其備餐家屬閱讀的「個人化護腎調配膳食處方簽」，格式為 Markdown。
撰寫大綱要點：
- 必須親切地稱呼病患（例如：彰美阿姨、彰秀先生、彰和大哥）。
- 第一部分【今日營養狀態總評】：用鼓勵、溫柔的口氣告訴他/她最新生化的營養狀況，以及為何飲食控制能在彰秀醫院多專科協助下守護腎臟與血糖。
- 第二部分【餐桌落實指南】：針對所勾選之主題（如：低鹽、限磷、低蛋白等），具體列出每餐如何分配（如一餐多少肉類、澱粉怎麼改低氮、哪些醬料千萬不碰）。
- 第三部分【備餐家屬重點】：如果是長輩，寫給協助備餐家屬的溫馨貼心小常識（如：蔬菜要滾水川燙去鉀、少用雞精大骨湯）。
- 第四部分【彰秀營養師暖心回診約定】：表達全力陪伴，共同穩健控制 HbA1c 與 eGFR 數值的溫暖結語。

請輸出精美排版、便於閱讀的純 Markdown 格式。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an incredibly encouraging, comforting, and medically precise Senior Renal Dietitian at 彰秀醫院. Output beautifully formatted patient-friendly Markdown. Ensure the tone is empathetic, accessible to elders, and structurally actionable."
        }
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.warn("AI Nutrition Summary error (falling back to high-fidelity local generator):", error);
      const summary = getLocalPatientNutritionSummary(patient, selectedTopics, nutritionistNotes);
      res.json({ summary });
    }
  });

  // 4. Generate Personalized Education Summary using Gemini
  app.post("/api/patient/generate-summary", async (req: Request, res: Response) => {
    const { patient, selectedTopics, educatorNotes } = req.body;
    if (!patient || !selectedTopics) {
      return res.status(400).json({ error: "參數不足！需包含病患資料與勾選之衛教主題。" });
    }

    if (!apiKey) {
      console.log("[Chang Shu Server] No GEMINI_API_KEY set, using high-fidelity local educator summary generator.");
      const summary = getLocalPatientSummary(patient, selectedTopics, educatorNotes);
      return res.json({ summary });
    }

    try {
      const prompt = `您是彰秀醫院的專業資深衛教師。現在請為病患「${patient.name}」產生一份「親切、易懂、極具個人關懷與指導性」的個人化衛教摘要。
病患背景：
診斷：${patient.diagnosis}
身長體重BMI：${patient.height}cm / ${patient.weight}kg / BMI ${patient.bmi} (營養評估參考)

衛教師在門診為他挑選並完成的主題：
${selectedTopics.map((t: any) => `- 【${t.title}】 (${t.category}) : ${t.description}`).join("\n")}

衛教師現場輔助備註：
${educatorNotes || "無額外特別備註"}

請將以上衛教主題內容轉換為一份專門為「${patient.name}」撰寫的衛教指引摘要，格式為 Markdown。
摘要撰寫要點：
- 必須親切稱呼病患（例如：彰美阿姨、彰秀先生、彰和大哥），拉近與病患家屬之距離。
- 第一部分【本次衛教重點核心】：提煉出今日的關鍵任務，用肯定且正向的語氣引導。
- 第二部分【飲食與生活落實方案】：將勾選主題（如：低鹽低蛋白、碳水化合物管理、或者低鉀低磷飲食）轉化為生活與彰秀醫院的日常對應配餐指引。
- 第三部分【異常指標與自我量測】：清楚說明病患自己該看什麼（例如：腳踝有無水腫、泡泡尿、每日早睡）。
- 第四部分【照護團隊叮嚀】：寫下一段無比溫暖的安心鼓勵，強調彰秀多專科團隊會與他一同守護。

請輸出純 Markdown 格式，不要包含 wrapping JSON，以供前端直接渲染渲染。`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are an affectionate, clinical, highly reassuring Chief Educator at 彰秀醫院. Output beautifully formatted Markdown with direct patient-facing advice. Keep the tone loving, motivating, and incredibly specific to Taiwanese elderly or middle-aged patients."
        }
      });

      res.json({ summary: response.text });
    } catch (error: any) {
      console.error("Summary Generation Error (falling back to high-fidelity local generator):", error);
      const summary = getLocalPatientSummary(patient, selectedTopics, educatorNotes);
      res.json({ summary });
    }
  });

  // 5. Save Completed Session & Return QR Link
  app.post("/api/session/save", (req: Request, res: Response) => {
    const { session } = req.body;
    if (!session || !session.patientId) {
      return res.status(400).json({ error: "儲存失敗，無效的衛教階段數據。" });
    }

    const sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Build permanent viewer link
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    const qrLink = `${appUrl}?view-summary=${sessionId}`;
    
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrLink)}`;

    const savedSession = {
      ...session,
      sessionId,
      qrcodeUrl: qrCodeApiUrl,
      completedAt: new Date().toISOString()
    };

    sessionStore[sessionId] = savedSession;

    return res.json({
      success: true,
      sessionId,
      qrcodeUrl: qrCodeApiUrl,
      viewerLink: qrLink
    });
  });

  // 6. Get Saved Session for Viewer Scan
  app.get("/api/session/:id", (req: Request, res: Response) => {
    const session = sessionStore[req.params.id];
    if (!session) {
      return res.status(404).json({ error: "查無此衛教歷史紀錄包，可能已被伺服器回收。" });
    }
    return res.json(session);
  });

  // Serve static assets / Vite implementation
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // PORT must be 3000
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Chang Shu Portal] Server loaded successfully on http://0.0.0.0:${PORT}`);
  });
}

startServer();
