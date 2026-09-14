import { Patient } from '../types';

export const mockPatients: Patient[] = [
  {
    id: "10010881",
    name: "林彰美",
    age: 62,
    gender: 'F',
    diagnosis: "第 2 型糖尿病併早期糖尿病腎病變 (Type 2 DM with Early Diabetic Nephropathy)",
    height: 155,
    weight: 68,
    bmi: 28.3,
    labHistory: [
      { date: "2025-09", fastingGlucose: 165, hba1c: 8.2, creatinine: 0.95, egfr: 65, uacr: 45, chol: 210, tg: 165 },
      { date: "2025-12", fastingGlucose: 158, hba1c: 7.9, creatinine: 0.98, egfr: 61, uacr: 52, chol: 205, tg: 158 },
      { date: "2026-03", fastingGlucose: 145, hba1c: 7.6, creatinine: 1.05, egfr: 58, uacr: 68, chol: 198, tg: 150 },
      { date: "2026-06", fastingGlucose: 172, hba1c: 8.3, creatinine: 1.15, egfr: 52, uacr: 110, chol: 215, tg: 180 }
    ],
    nutritionHistory: [
      {
        id: "N-881-01",
        date: "2025-09-15",
        nutritionist: "廖淑惠 營養師",
        weight: 71.0,
        bmi: 29.5,
        pesDiagnosis: "飲食不當/醣類食物攝取不當 (NI-5.8.2)，與平時喜食精緻中式米點及水果攝取過量有關。",
        intervention: "1. 碳水主食定量：每正餐白米飯限 2/3 碗，避免糕點或勾芡羹湯。\n2. 水果限制：水果每日最多 2 份，限於正餐間隔 2 小時後食用。\n3. 自我監測：一週 3 天配對量測餐前後血糖、早晚量測血壓。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：身高 155cm，體重 71kg，BMI 29.5 (輕度肥胖)。\n- 生化：最新 HbA1c 8.2%、eGFR 65 mL/min、UACR 45 mg/g。\n- 飲食：平時喜食中部特產麵線糊與甜糯米製品，極少注意主食代換。\n\n[D] Diagnosis:\n- PES 診斷：醣類食物選擇不當相關之高血糖，與精緻碳水超標相關，表現在 HbA1c 8.2%。\n\n[I] Intervention:\n- 進行糖尿病配膳衛教、醣類代換指南、戒除含糖小吃、每餐米飯上限為 2/3 碗。\n\n[M] Monitoring:\n- 計畫 3 個月內將 HbA1c 降至 7.5% 以下，體重目標每週緩降 0.5kg。"
      },
      {
        id: "N-881-02",
        date: "2025-12-20",
        nutritionist: "廖淑惠 營養師",
        weight: 69.5,
        bmi: 28.9,
        pesDiagnosis: "飲食不當/過量蛋白質攝取負荷 (NI-5.7.1)，與未確實進行早期低蛋白米食限制有關。",
        intervention: "1. 蛋白質定額控管：以優質高生理價蛋白質（大豆製品、白肉、蛋蛋白）為主，限制每日 5 份肉類。\n2. 溫熱水川燙：蔬菜必須滾水川燙後，倒去湯汁再油拌烹調以去鉀。\n3. 限鈉：每日食鹽限制 < 5g，禁食加工醃漬及沙茶。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：體重微幅調降至 69.5kg，BMI 28.9。\n- 生化：最新 HbA1c 7.9%、eGFR 61 mL/min、UACR 52 mg/g 呈上升趨勢。\n- 飲食：蛋白質攝取稍高，每日肉類約 7~8 份，多外食排骨便當。\n\n[D] Diagnosis:\n- PES 診斷：蛋白質攝取過高，與外食肉類控額不佳相關，表現在 UACR 升至 52 mg/g，腎臟負荷加大。\n\n[I] Intervention:\n- 啟動腎病變低蛋白飲食指導（0.8g/kg/day），建議其中 50% 採用大豆蛋白與優質蛋白；教導精細去鈉與川燙青菜去鉀技巧。\n\n[M] Monitoring:\n- 追蹤下次生化 UACR 是否穩定，並控制 HbA1c 穩定在 7.5% 左右。"
      },
      {
        id: "N-881-03",
        date: "2026-03-25",
        nutritionist: "張凱筌 營養師",
        weight: 68.5,
        bmi: 28.5,
        pesDiagnosis: "飲料與精緻糖攝取過高 (NI-5.8.5)，與居家常態使用加工肉與飲用罐裝燕麥奶作為養生點心有關。",
        intervention: "1. 導入低氮澱粉代換：每正餐以冬粉、西谷米或澄粉替代部分白飯，以兼顧飽足感與低蛋白要求。\n2. 嚴控常規隱性糖：停止罐裝燕麥奶與含糖養生飲。\n3. 自主水腫評估：每日指壓小腿，觀察晨尿細泡沫。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：體重 68.5kg，BMI 28.5。\n- 生化：HbA1c 7.6% 改善，但 eGFR 降至 58 mL/min（跨入 CKD 3期 警訊），UACR 升至 68 mg/g。\n- 飲食：平時以罐裝即飲燕麥與堅果奶作為健康點心，致隱形高磷及植物蛋白質總量超載。\n\n[D] Diagnosis:\n- PES 診斷：礦物質（磷、鉀）及蛋白質管理不當，與使用高磷即飲燕麥及堅果相關，表現在 UACR 上升及 eGFR 破 60 限。\n\n[I] Intervention:\n- 立即停用含糖燕麥奶與養生堅果，正餐導入低氮澱粉代換，維持全日熱量以防止負氮平衡造成肌肉萎縮。\n\n[M] Monitoring:\n- 追蹤 3 個月內 eGFR 走向，防堵腎絲球高過濾壓持續惡化。"
      }
    ]
  },
  {
    id: "10010882",
    name: "陳彰秀",
    age: 48,
    gender: 'M',
    diagnosis: "新診斷第 2 型糖尿病、嚴重高血脂症、中度脂肪肝 (Newly Diagnosed Type 2 DM, Severe Hyperlipidemia, Moderate Fatty Liver)",
    height: 175,
    weight: 92,
    bmi: 30.0,
    labHistory: [
      { date: "2025-09", fastingGlucose: 110, hba1c: 6.2, creatinine: 0.85, egfr: 92, uacr: 12, chol: 245, tg: 220 },
      { date: "2025-12", fastingGlucose: 126, hba1c: 6.5, creatinine: 0.88, egfr: 90, uacr: 15, chol: 238, tg: 210 },
      { date: "2026-03", fastingGlucose: 142, hba1c: 7.2, creatinine: 0.90, egfr: 88, uacr: 22, chol: 252, tg: 235 },
      { date: "2026-06", fastingGlucose: 198, hba1c: 8.8, creatinine: 0.94, egfr: 85, uacr: 28, chol: 268, tg: 260 }
    ],
    nutritionHistory: [
      {
        id: "N-882-01",
        date: "2025-12-10",
        nutritionist: "陳曉林 營養師",
        weight: 95.0,
        bmi: 31.0,
        pesDiagnosis: "飲食知識缺乏/高脂膳食選擇 (NB-1.1)，與未曾接受過糖尿病專科飲食諮詢、愛食煎炸有關。",
        intervention: "1. 進行一日四格健康餐盤推廣：每正餐主食限制為一平碗、蔬菜至少佔一碗半。\n2. 飽和脂肪限額：戒除五花肉、雞皮、豬油，每天油脂控制在 3-4 茶匙，並以芥花油代之。\n3. 限制卡路里與反式脂肪，夜市精緻炸物頻率降為一個月至多一次。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：身高 175cm、體重 95kg、BMI 31.0 (中度肥胖)。\n- 生化：最新 HbA1c 6.5%、Fasting Glucose 126 mg/dL。\n- 飲食：多應酬且喜愛夜市炸雞排等高飽和油脂飲食。\n\n[D] Diagnosis:\n- PES 診斷：肥胖與高脂飲食知識缺乏，表現在 BMI 31 及血脂高攀。\n\n[I] Intervention:\n- 示範健康餐盤，教授油炸物去皮、外食少油技巧；約定每週進行 150 分鐘中強度運動（如快步走）。\n\n[M] Monitoring:\n- 目標 3 個月內體重減低 3%，控制血脂指標。"
      },
      {
        id: "N-882-02",
        date: "2026-03-12",
        nutritionist: "陳曉林 營養師",
        weight: 93.2,
        bmi: 30.4,
        pesDiagnosis: "飲食不當/醣類與酒精攝取過多 (NI-5.8.2)，與應酬、飲酒及外食便當次數偏高、未確實限醣相關。",
        intervention: "1. 飲酒管制：酒精降至每週不超過 2 當量（如兩小杯啤酒）。\n2. 減醣配比：晚餐碳水比例降至半碗米飯，並大幅增加深綠色蔬菜膳食纖維、餐後禁止吃零食。\n3. 自我監測：每天至少測量一次空腹血糖，維持運動記錄。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：體重 93.2kg、BMI 30.4。\n- 生化：HbA1c 攀升至 7.2%，Fasting Glucose 142 mg/dL，糖毒性表現加重。\n- 飲食：近期應酬多酒精攝取頻率高，外食便當常吃精緻中式羹湯與飽和肥肉。\n\n[D] Diagnosis:\n- PES 診斷：精製醣類與精緻碳水攝取過盛，與應酬頻繁相關，表現在 HbA1c 急速高漲至 7.2%。\n\n[I] Intervention:\n- 實施限酒計畫，示範外食「飯水分離」及去勾芡方法，下調米飯分量（每餐 1/2 至 2/3 碗）。\n\n[M] Monitoring:\n- 追蹤下季 HbA1c 改善程度，要求空腹血糖值朝 110 mg/dL 靠攏。"
      }
    ]
  },
  {
    id: "10010883",
    name: "王彰和",
    age: 70,
    gender: 'M',
    diagnosis: "第 2 型糖尿病 (病史 20 年)、慢性腎臟病第三期 (CKD Stage 3b)、高血壓 (Type 2 DM, Chronic Kidney Disease Stage 3b, Hypertension)",
    height: 162,
    weight: 55,
    bmi: 21.0,
    labHistory: [
      { date: "2025-09", fastingGlucose: 132, hba1c: 7.1, creatinine: 1.45, egfr: 42, uacr: 240, chol: 175, tg: 140 },
      { date: "2025-12", fastingGlucose: 135, hba1c: 7.2, creatinine: 1.58, egfr: 38, uacr: 290, chol: 180, tg: 145 },
      { date: "2026-03", fastingGlucose: 125, hba1c: 6.9, creatinine: 1.68, egfr: 35, uacr: 320, chol: 172, tg: 138 },
      { date: "2026-06", fastingGlucose: 138, hba1c: 7.3, creatinine: 1.85, egfr: 31, uacr: 410, chol: 168, tg: 130 }
    ],
    nutritionHistory: [
      {
        id: "N-883-01",
        date: "2025-11-05",
        nutritionist: "張凱筌 營養師",
        weight: 57.0,
        bmi: 21.7,
        pesDiagnosis: "過濾機能持續退化及飲食蛋白質攝取管理不當 (NI-5.7.1)，與偏好醃製品及中藥燉高湯相關。",
        intervention: "1. 嚴控高鹽中藥：嚴禁飲用各種藥燉補湯、動物骨贅大骨湯，鹽鈉攝取每日限用 < 4g。\n2. 極致低蛋白調配：每日總蛋白定額 0.6g/kg（約 33 克 ），主責來源多以優生理價蛋白為主。\n3. 優質熱量：引進澄粉與西谷米膳食，充盈熱量防止患者消瘦。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：身高 162cm、體重 57kg、BMI 21.7。\n- 生化：最新 eGFR 38 (CKD 3b期)、UACR 290 mg/g 發出黃色預警。\n- 飲食：平日常以冬瓜罐頭佐餐，且習慣飲用配餐大骨高湯，含高量鉀、鈉、磷。\n\n[D] Diagnosis:\n- PES 診斷：高鈉蛋白攝取不當，與愛吃中藥燉高湯和加工漬物相關，表現在 UACR 升至 290 mg/g。\n\n[I] Intervention:\n- 停用餐盤大骨高湯與醃漬罐頭，設計每日 33g 的慢腎低蛋白限制食譜，並指引家人用量勺量精準減鹽。\n\n[M] Monitoring:\n- 追蹤下次 eGFR 與血鈉情況，控制 UACR 不要跨過 300 門檻。"
      },
      {
        id: "N-883-02",
        date: "2026-03-18",
        nutritionist: "張凱筌 營養師",
        weight: 55.8,
        bmi: 21.3,
        pesDiagnosis: "熱量攝取不足 (NI-1.2)，與因過度害怕腎病變洗腎而極端限食、負氮平衡消耗體脂相關。",
        intervention: "1. 全程阻絕負氮崩解：每正餐正向添加 1~2 茶匙玄米油烹製蔬菜，並於餐間補充半包慢腎病專用無糖營養品。\n2. 青菜川燙技巧：葉菜皆需切段洗淨，大火滾水川燙 5 分鐘撈起，倒掉菜湯不飲用。\n3. 主食替換：其中一餐完全以西谷米甜羹或澄粉冬粉取代部分米製澱粉，維持熱量儲備。",
        adimeText: "【彰秀醫院 臨床營養評估 (ADIME)】\n\n[A] Assessment:\n- 體位：體重 55.8kg、BMI 21.3 ( 相比前半年持續下降 )。\n- 生化：eGFR 35 mL/min、HbA1c 6.9%。\n- 飲食：個案與家屬為規避洗腎，極度限制每餐食量，主食每餐僅吃兩三口，出現全身乏力、肌肉少化風險。\n\n[D] Diagnosis:\n- PES 診斷：限制過度導致顯著熱量攝取不足，與不了解低蛋白熱量補充技巧相關，表現在體重急劇下降。\n\n[I] Intervention:\n- 心理疏導解除恐洗腎焦慮。衛教高油脂低氮代代換，每日食譜追加 250 kcal 烹調用油與低氮點心，以防耗損肌肉組織。\n\n[M] Monitoring:\n- 追蹤一個月後體重是否恢復到 56.5~57.0kg 之間，測量手握力追蹤肌力狀況。"
      }
    ]
  }
];
