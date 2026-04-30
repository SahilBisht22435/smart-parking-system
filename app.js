const FLOORS = 4;
const SLOTS_PER_FLOOR = 30;
const STORAGE_KEY = "smartParkingData";

let parking = [];
let vehicles = {};
let history = [];
let waitingQueue = [];
let vipQueue = [];
let undoStack = [];
let lastReceiptText = "";

function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value.trim();

  if ((u === "admin" && p === "1234") || (u === "admin1" && p === "12345")) {
    sessionStorage.setItem("isLoggedIn", "true");
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("app").style.display = "flex";
    showToast("Login successful");
  } else {
    alert("Wrong credentials");
  }
}

function checkLoginState() {
  const isLoggedIn = sessionStorage.getItem("isLoggedIn");//Used to keep user logged in after refresh.
  document.getElementById("loginPage").style.display = isLoggedIn ? "none" : "block";
  document.getElementById("app").style.display = isLoggedIn ? "flex" : "none";
}

// to end session
function logout() {
  sessionStorage.removeItem("isLoggedIn");
  location.reload();
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}

// function saveData() {
//   localStorage.setItem(
//     STORAGE_KEY,
//     JSON.stringify({ parking, vehicles, history, waitingQueue, vipQueue, undoStack })
//   );
// }


async function loadData() {
  const res = await fetch("http://localhost:5000/load");//This fetches parking data from MongoDB.
  const data = await res.json();

  if (!data || !data.parking) {
    initParking();
    return;
  }

  parking = data.parking || [];
  vehicles = data.vehicles || {};
  history = data.history || [];
  waitingQueue = data.waitingQueue || [];
  vipQueue = data.vipQueue || [];
  undoStack = data.undoStack || [];

  Object.keys(vehicles).forEach(no => {
    vehicles[no].entry = new Date(vehicles[no].entry);
  });

  history = history.map(h => ({
    ...h,
    entry: new Date(h.entry),
    exit: new Date(h.exit)
  }));
}

// function loadData() {
//   const saved = localStorage.getItem(STORAGE_KEY);
//   if (!saved) {
//     initParking();
//     return;
//   }

//This sends updated parking state to backend.
async function saveData() {
  await fetch("http://localhost:5000/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parking,
      vehicles,
      history,
      waitingQueue,
      vipQueue,
      undoStack
    })
  });
}


function showSection(id, el = null) {
  document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  document.querySelectorAll(".sidebar ul li").forEach(li => li.classList.remove("active"));
  if (el) el.classList.add("active");
}

function initParking() {
  parking = [];

  for (let f = 0; f < FLOORS; f++) {
    let floor = [];
    for (let s = 0; s < SLOTS_PER_FLOOR; s++) {
      floor.push({
        occupied: false,
        vehicle: null,
        type: f === FLOORS - 1 ? "vip" : "normal"
      });
    }
    parking.push(floor);
  }

  vehicles = {};
  history = [];
  waitingQueue = [];
  vipQueue = [];
  undoStack = [];
  lastReceiptText = "";

  saveData();
}

// function to calculate total earning.
function calculateTotalEarnings() {
  let total = 0;

  history.forEach(h => {
    total += Number(h.total) || 0;
  });

  return total;
}

function calculateDailyEarnings() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const now = new Date();
  let total = 0;

  history.forEach(h => {
    const exitTime = new Date(h.exit);

    if (exitTime >= todayStart && exitTime <= now) {
      total += Number(h.total) || 0;
    }
  });

  return total;
}



function calculateRepeatVisitsToday() {
  const today = new Date().toDateString();
  const vehicleCount = {};

  history.forEach(h => {
    const exitDate = new Date(h.exit).toDateString();

    if (exitDate === today) {
      vehicleCount[h.number] = (vehicleCount[h.number] || 0) + 1;
    }
  });

  const repeatVehicles = [];

  Object.keys(vehicleCount).forEach(number => {
    if (vehicleCount[number] > 1) {
      repeatVehicles.push({
        number: number,
        count: vehicleCount[number]
      });
    }
  });

  return repeatVehicles;
}
//update dashboard with totalslots, occupied,available,vipcount,totalearning.
function updateDashboard() {
  let total = FLOORS * SLOTS_PER_FLOOR;
  let occupied = 0;
  let vip = 0;

  parking.forEach(floor => {
    floor.forEach(slot => {
      if (slot.occupied) occupied++;
      if (slot.type === "vip") vip++;
    });
  });

  document.getElementById("totalSlots").innerText = total;
  document.getElementById("occupiedSlots").innerText = occupied;
  document.getElementById("availableSlots").innerText = total - occupied;
  document.getElementById("vipCount").innerText = vip;
  document.getElementById("totalEarnings").innerText = calculateTotalEarnings().toFixed(2);
  document.getElementById("dailyEarnings").innerText = calculateDailyEarnings().toFixed(2);
  const repeatVehicles = calculateRepeatVisitsToday();

document.getElementById("repeatVisits").innerText = repeatVehicles.length;

document.getElementById("repeatVehicleList").innerText =
  repeatVehicles.length === 0
    ? "None"
    : repeatVehicles.map(v => `${v.number} (${v.count} times)`).join(", ");
}

function renderQueues() {
  const normalQueueList = document.getElementById("normalQueueList");
  const vipQueueList = document.getElementById("vipQueueList");

  normalQueueList.innerHTML = "";
  vipQueueList.innerHTML = "";

  if (waitingQueue.length === 0) {
    normalQueueList.innerHTML = "<li>No vehicles</li>";
  } else {
    waitingQueue.forEach(v => {
      normalQueueList.innerHTML += `<li>${v.number}</li>`;
    });
  }

  if (vipQueue.length === 0) {
    vipQueueList.innerHTML = "<li>No vehicles</li>";
  } else {
    vipQueue.forEach(v => {
      vipQueueList.innerHTML += `<li>${v.number}</li>`;
    });
  }
}

function findSlot(type) {
  for (let f = 0; f < FLOORS; f++) {
    for (let s = 0; s < SLOTS_PER_FLOOR; s++) {
      if (!parking[f][s].occupied && parking[f][s].type === type) {
        return { floor: f, slot: s };
      }
    }
  }
  return null;
}

function getDirection(floor, slot) {
  const side = slot < Math.ceil(SLOTS_PER_FLOOR / 2) ? "Left Wing" : "Right Wing";
  return `Go to Floor ${floor + 1}, ${side}, Slot ${slot + 1}`;
}

async function handleEntry() {
  const no = document.getElementById("vehicleNumber").value.trim().toUpperCase();
  const type = document.getElementById("vehicleType").value;
  const assignedInfo = document.getElementById("assignedInfo");

  if (!no) {
    showToast("Enter vehicle number");
    return;
  }

  if (vehicles[no]) {
    showToast("Already parked");
    return;
  }

  const inNormalQueue = waitingQueue.some(v => v.number === no);
  const inVipQueue = vipQueue.some(v => v.number === no);

  if (inNormalQueue || inVipQueue) {
    showToast("Vehicle already in queue");
    return;
  }

  const slot = findSlot(type);

  if (!slot) {
    const obj = { number: no, type, entry: new Date() };
    if (type === "vip") vipQueue.push(obj);
    else waitingQueue.push(obj);

    assignedInfo.innerHTML = "";
    showToast("Added to queue");
    await saveData();
    renderAll();
    return;
  }

  parking[slot.floor][slot.slot] = { occupied: true, vehicle: no, type };
  vehicles[no] = {
    floor: slot.floor,
    slot: slot.slot,
    type,
    entry: new Date()
  };

  undoStack.push({ action: "entry", number: no });

  const direction = getDirection(slot.floor, slot.slot);
  assignedInfo.innerHTML = `
    <strong>Assigned Slot:</strong> Floor ${slot.floor + 1}, Slot ${slot.slot + 1}<br>
    <strong>Direction:</strong> ${direction}
  `;

  document.getElementById("beep").play();
  showToast("Parked");

  document.getElementById("vehicleNumber").value = "";
  await saveData();
  renderAll();
}

// assigns slot to the vehicles in queue
function assignQueuedVehicle(slotType, floor, slot) {
  let nextVehicle = null;

  if (slotType === "vip" && vipQueue.length > 0) {
    nextVehicle = vipQueue.shift();
  } else if (slotType === "normal" && waitingQueue.length > 0) {
    nextVehicle = waitingQueue.shift();
  }

  if (nextVehicle) {
    parking[floor][slot] = {
      occupied: true,
      vehicle: nextVehicle.number,
      type: slotType
    };

    vehicles[nextVehicle.number] = {
      floor,
      slot,
      type: nextVehicle.type,
      entry: new Date()
    };

    showToast(`${nextVehicle.number} assigned from queue`);
  }
}

// used to handle exit of a vehicle
async function handleExit() {
  const no = document.getElementById("exitVehicle").value.trim().toUpperCase();
  const d = vehicles[no];

  if (!d) {
    showToast("Not found");
    return;
  }

  const exit = new Date();
  const hours = Math.max(1, Math.ceil((exit - d.entry) / (1000 * 60 * 60)));
  const rate = d.type === "vip" ? 70 : 40;
  const gst = hours * rate * 0.18;
  const total = hours * rate + gst;

  parking[d.floor][d.slot] = { occupied: false, vehicle: null, type: d.type };

  history.push({
    number: no,
    type: d.type,
    entry: d.entry,
    exit,
    total
  });

  undoStack.push({
    action: "exit",
    number: no,
    data: { ...d }
  });

  delete vehicles[no];

  assignQueuedVehicle(d.type, d.floor, d.slot);
  generateSlip(no, d, exit, hours, rate, gst, total);

  document.getElementById("beep").play();
  showToast("Exited");
  console.log("Parking after exit:", parking);

  document.getElementById("exitVehicle").value = "";
  await saveData();
  renderAll();
}

function handleSearch() {
  const no = document.getElementById("searchVehicleInput").value.trim().toUpperCase();
  const result = document.getElementById("searchResult");

  if (!no) {
    result.innerText = "⚠️ Enter vehicle number";
    return;
  }

  if (vehicles[no]) {
    const v = vehicles[no];
    result.innerText = `🚗 FOUND
    Floor: ${v.floor + 1}
    Slot: ${v.slot + 1}
    Type: ${v.type.toUpperCase()}
    Direction: ${getDirection(v.floor, v.slot)}`;
    return;
  }

  if (vipQueue.some(v => v.number === no)) {
    result.innerText = "⭐ Vehicle in VIP Queue";
    return;
  }

  if (waitingQueue.some(v => v.number === no)) {
    result.innerText = "🕒 Vehicle in Waiting Queue";
    return;
  }

  result.innerText = "❌ Vehicle Not Found";
}

function verifySlot() {
  const vehicleNo = document.getElementById("verifyVehicle").value.trim().toUpperCase();
  const actualFloor = parseInt(document.getElementById("actualFloor").value, 10);
  const actualSlot = parseInt(document.getElementById("actualSlot").value, 10);
  const resultBox = document.getElementById("verifyResult");

  if (!vehicleNo || !actualFloor || !actualSlot) {
    showToast("Enter all verification details");
    return;
  }

  const vehicle = vehicles[vehicleNo];
  if (!vehicle) {
    resultBox.innerHTML = `<strong>❌ Vehicle not found in system</strong>`;
    return;
  }

  const assignedFloor = vehicle.floor + 1;
  const assignedSlot = vehicle.slot + 1;

  if (assignedFloor === actualFloor && assignedSlot === actualSlot) {
    resultBox.innerHTML = `
      <strong>✅ Verified Successfully</strong><br>
      Vehicle: ${vehicleNo}<br>
      Assigned Slot: Floor ${assignedFloor}, Slot ${assignedSlot}<br>
      Actual Slot: Floor ${actualFloor}, Slot ${actualSlot}<br>
      Status: Correct Parking
    `;
  } else {
    resultBox.innerHTML = `
      <strong>❌ Wrong Parking Detected</strong><br>
      Vehicle: ${vehicleNo}<br>
      Assigned Slot: Floor ${assignedFloor}, Slot ${assignedSlot}<br>
      Actual Slot: Floor ${actualFloor}, Slot ${actualSlot}<br>
      Status: Vehicle parked in wrong slot
    `;
  }
}

function findMyCar() {
  const vehicleNo = document.getElementById("findVehicleInput").value.trim().toUpperCase();
  const resultBox = document.getElementById("findCarResult");

  if (!vehicleNo) {
    showToast("Enter vehicle number");
    return;
  }

  const vehicle = vehicles[vehicleNo];
  if (!vehicle) {
    resultBox.innerHTML = `<strong>❌ Car not found</strong>`;
    renderParking();
    return;
  }

  const direction = getDirection(vehicle.floor, vehicle.slot);
  resultBox.innerHTML = `
    <strong>✅ Car Found</strong><br>
    Vehicle: ${vehicleNo}<br>
    Floor: ${vehicle.floor + 1}<br>
    Slot: ${vehicle.slot + 1}<br>
    Type: ${vehicle.type.toUpperCase()}<br>
    Direction: ${direction}
  `;

  renderParking();
}

function generateSlip(no, d, exit, hours, rate, gst, total) {
  const receipt = document.getElementById("receipt");
  const direction = getDirection(d.floor, d.slot);

  receipt.innerHTML = `
    <h3>SMART PARKING RECEIPT</h3>
    <p><strong>Vehicle:</strong> ${no}</p>
    <p><strong>Type:</strong> ${d.type.toUpperCase()}</p>
    <p><strong>Assigned Slot:</strong> Floor ${d.floor + 1}, Slot ${d.slot + 1}</p>
    <p><strong>Direction:</strong> ${direction}</p>
    <p><strong>Entry:</strong> ${new Date(d.entry).toLocaleString()}</p>
    <p><strong>Exit:</strong> ${exit.toLocaleString()}</p>
    <p><strong>Hours:</strong> ${hours}</p>
    <p><strong>Rate:</strong> ₹${rate}/hour</p>
    <p><strong>GST:</strong> ₹${gst.toFixed(2)}</p>
    <p><strong>Total:</strong> ₹${total.toFixed(2)}</p>
    <div id="qrcode"></div>
  `;

  const qrDiv = document.getElementById("qrcode");
  qrDiv.innerHTML = "";

  const qrText =
`Vehicle: ${no}
Type: ${d.type.toUpperCase()}
Floor: ${d.floor + 1}
Slot: ${d.slot + 1}
Direction: ${direction}
Total: ₹${total.toFixed(2)}`;

  new QRCode(qrDiv, {
    text: qrText,
    width: 110,
    height: 110
  });

  lastReceiptText =
`SMART PARKING RECEIPT
Vehicle: ${no}
Type: ${d.type.toUpperCase()}
Assigned Slot: Floor ${d.floor + 1}, Slot ${d.slot + 1}
Direction: ${direction}
Entry: ${new Date(d.entry).toLocaleString()}
Exit: ${exit.toLocaleString()}
Hours: ${hours}
Rate: ₹${rate}/hour
GST: ₹${gst.toFixed(2)}
Total: ₹${total.toFixed(2)}`;
}

function downloadPDF() {
  if (!lastReceiptText) {
    showToast("No receipt");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const lines = doc.splitTextToSize(lastReceiptText, 180);
  doc.text(lines, 10, 10);
  doc.save("parking-slip.pdf");
}

function resetSystem() {
  document.getElementById("resetModal").classList.add("show");
}

function closeModal() {
  document.getElementById("resetModal").classList.remove("show");
}


//Calls backend reset API.
async function confirmReset() {
  await fetch("http://localhost:5000/reset", {
    method: "POST"
  });

  initParking();
  renderAll();
  closeModal();
  showToast("System Reset Successfully");
}

window.addEventListener("click", function (e) {
  const modal = document.getElementById("resetModal");
  if (e.target === modal) {
    closeModal();
  }
});


//Restores previous action.
async function undo() {
  if (undoStack.length === 0) {
    showToast("Nothing to undo");
    return;
  }

  const lastAction = undoStack.pop();

  if (lastAction.action === "entry") {
    const no = lastAction.number;
    const d = vehicles[no];
    if (d) {
      parking[d.floor][d.slot] = { occupied: false, vehicle: null, type: d.type };
      delete vehicles[no];
      showToast("Last entry undone");
    }
  } else if (lastAction.action === "exit") {
    const no = lastAction.number;
    const d = lastAction.data;

    if (!vehicles[no]) {
      parking[d.floor][d.slot] = { occupied: true, vehicle: no, type: d.type };
      vehicles[no] = d;

      if (history.length > 0 && history[history.length - 1].number === no) {
        history.pop();
      }

      showToast("Last exit undone");
    }
  }

  await saveData();
  renderAll();
}

function renderParking() {
  const floorContainer = document.getElementById("floorContainer");
  floorContainer.innerHTML = "";

  const currentFindVehicle = document.getElementById("findVehicleInput")
    ? document.getElementById("findVehicleInput").value.trim().toUpperCase()
    : "";

  parking.forEach((floor, f) => {
    let div = document.createElement("div");
    div.className = "floor";
    div.innerHTML = `<h3>Floor ${f + 1}</h3>`;

    floor.forEach((s, i) => {
      let slot = document.createElement("div");

      let isFoundCar = false;
      if (currentFindVehicle && vehicles[currentFindVehicle]) {
        const foundVehicle = vehicles[currentFindVehicle];
        isFoundCar = foundVehicle.floor === f && foundVehicle.slot === i;
      }

      slot.className =
        "slot " +
        (isFoundCar
          ? "found-slot"
          : (s.occupied ? "occupied" : s.type === "vip" ? "vip" : "free"));

      if (s.occupied) {
        slot.innerHTML = s.type === "vip" ? "🚘" : "🚗";
      } else {
        slot.innerHTML = i + 1;
      }

      slot.title = s.occupied
        ? `Vehicle: ${s.vehicle}`
        : `${s.type.toUpperCase()} Slot`;

      div.appendChild(slot);
    });

    floorContainer.appendChild(div);
  });
}

function renderHistory() {
  const historyTable = document.getElementById("historyTable");
  historyTable.innerHTML = "";

  history.forEach(h => {
    historyTable.innerHTML += `
      <tr>
        <td>${h.number}</td>
        <td>${h.type.toUpperCase()}</td>
        <td>${new Date(h.entry).toLocaleString()}</td>
        <td>${new Date(h.exit).toLocaleString()}</td>
        <td>₹${h.total.toFixed(2)}</td>
      </tr>
    `;
  });
}

function renderAll() {
  updateDashboard();
  renderQueues();
  renderParking();
  renderHistory();
}

//Load DB, Render UI and Check Login

window.onload = async () => {
  await loadData();
  renderAll();
  checkLoginState();
};
