document.addEventListener("DOMContentLoaded", function () {
    const quotes = [
        "\"Stay focused and never give up!\"",
        "\"The only way to do great work is to love what you do.\"",
        "\"Believe in yourself and all that you are.\"",
        "\"You are capable of amazing things.\"",
        "\"Don’t watch the clock; do what it does. Keep going.\"",
        "\"Success is not final, failure is not fatal: It is the courage to continue that counts.\"",
        "\"The harder you work for something, the greater you’ll feel when you achieve it.\"",
        "\"Dream it. Wish it. Do it.\""
    ];

    let quoteIndex = 0;
    let charIndex = 0;
    const quoteElement = document.querySelector(".quote");

    function typeQuote() {
        if (!quoteElement) return;

        if (charIndex < quotes[quoteIndex].length) {
            quoteElement.textContent += quotes[quoteIndex].charAt(charIndex);
            charIndex++;
            setTimeout(typeQuote, 60);
        } else {
            setTimeout(() => {
                quoteElement.textContent = "";
                charIndex = 0;
                quoteIndex = (quoteIndex + 1) % quotes.length;
                typeQuote();
            }, 2500); // wait before next quote
        }
    }

    typeQuote(); // start animation
;


  document.addEventListener("DOMContentLoaded", typeQuote);

        // ✅ DOM elements initialized first
    const taskInput = document.getElementById("taskInput");
    const dueDateInput = document.getElementById("dueDateInput");
    const categorySelect = document.getElementById("categorySelect");
    const addTaskBtn = document.getElementById("addTaskBtn");
    const taskList = document.getElementById("taskList");
    const emptyMessage = document.getElementById("emptyMessage");

        // ✅ Now it's safe to call this
    loadTasksFromLocal();

    function updateEmptyMessage() {
        emptyMessage.style.display = taskList.children.length === 0 ? "block" : "none";
    }

    function createTaskElement(taskText, category, dueDate, status = "active") {
        const li = document.createElement("li");
        if (status === "completed") li.classList.add("completed");

        li.innerHTML = `
            <span class="task-text">${taskText}</span>
            ${category ? `<span class="task-tag">${category}</span>` : ""}
            ${dueDate ? `<span class="due-date">Due: ${dueDate}</span>` : ""}
            <button class="complete-btn"><i class="fas fa-check"></i></button>
            <button class="edit-btn"><i class="fas fa-edit"></i></button>
            <button class="delete-btn"><i class="fas fa-trash"></i></button>
        `;

        li.querySelector(".complete-btn").addEventListener("click", () => {
            li.classList.toggle("completed");
            saveTasksToLocal();
        });

        li.querySelector(".delete-btn").addEventListener("click", () => {
            li.remove();
            saveTasksToLocal();
            updateEmptyMessage();
        });

        li.querySelector(".edit-btn").addEventListener("click", () => editTask(li));

        return li;
    }

    function editTask(li) {
        const taskTextEl = li.querySelector(".task-text");
        const tagEl = li.querySelector(".task-tag");
        const dueEl = li.querySelector(".due-date");

        const oldText = taskTextEl.textContent;
        const oldCategory = tagEl ? tagEl.textContent : "";
        const oldDate = dueEl ? dueEl.textContent.replace("Due: ", "") : "";

        li.innerHTML = `
            <input type="text" class="edit-text" value="${oldText}" />
            <input type="date" class="edit-date" value="${oldDate}" />
            <select class="edit-category">
                <option value="">Select Category</option>
                <option value="Work"${oldCategory === "Work" ? " selected" : ""}>Work</option>
                <option value="Home"${oldCategory === "Home" ? " selected" : ""}>Home</option>
                <option value="Personal"${oldCategory === "Personal" ? " selected" : ""}>Personal</option>
                <option value="Urgent"${oldCategory === "Urgent" ? " selected" : ""}>Urgent</option>
            </select>
            <button class="save-btn"><i class="fas fa-check-circle"></i></button>
        `;

        li.querySelector(".save-btn").addEventListener("click", () => {
            const newText = li.querySelector(".edit-text").value.trim();
            const newDate = li.querySelector(".edit-date").value;
            const newCat = li.querySelector(".edit-category").value;

            if (!newText) return alert("Task text cannot be empty!");

            const newLi = createTaskElement(newText, newCat, newDate, li.classList.contains("completed") ? "completed" : "active");
            taskList.replaceChild(newLi, li);
            saveTasksToLocal();
        });
    }

    function saveTasksToLocal() {
        const tasks = [];
        taskList.querySelectorAll("li").forEach(li => {
            const text = li.querySelector(".task-text")?.textContent || "";
            const category = li.querySelector(".task-tag")?.textContent || "";
            const due = li.querySelector(".due-date")?.textContent.replace("Due: ", "") || "";
            const completed = li.classList.contains("completed") ? "completed" : "active";
            tasks.push({ text, category, date: due, status: completed });
        });
        localStorage.setItem("todoTasks", JSON.stringify(tasks));
    }

    function loadTasksFromLocal() {
        const tasks = JSON.parse(localStorage.getItem("todoTasks")) || [];
        tasks.forEach(task => {
            const taskEl = createTaskElement(task.text, task.category, task.date, task.status);
            taskList.appendChild(taskEl);
        });
        updateEmptyMessage();
    }

    function renderTask(text, category, date) {
        const newTask = createTaskElement(text, category, date);
        taskList.appendChild(newTask);
        updateEmptyMessage();
        saveTasksToLocal();
    }

    addTaskBtn.addEventListener("click", () => {
        const taskText = taskInput.value.trim();
        const dueDate = dueDateInput.value;
        const category = categorySelect.value;

        if (!taskText) {
            alert("Please enter a task.");
            return;
        }

        renderTask(taskText, category, dueDate);

        taskInput.value = "";
        dueDateInput.value = "";
        categorySelect.value = "";
    });

    updateEmptyMessage();

    // feedback
    document.getElementById("feedbackBtn").onclick = function() {
  const form = document.getElementById("feedbackForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
};

});


  // Wait for DOM to load
  document.addEventListener("DOMContentLoaded", function () {
    emailjs.init("lReIwE6OjDFyj-zlP"); // Your EmailJS public key

    // Toggle feedback form
    document.getElementById("feedbackBtn").addEventListener("click", () => {
      const form = document.getElementById("feedbackForm");
      form.style.display = form.style.display === "block" ? "none" : "block";
    });

    // Handle form submission
    document.getElementById("form").addEventListener("submit", function (e) {
      e.preventDefault();
      emailjs.sendForm("service_8dqwecs", "template_znkyk1e", this)
        .then(() => {
          alert("Feedback sent successfully!");
          this.reset();
          document.getElementById("feedbackForm").style.display = "none";
        })
        .catch(error => {
          alert("Error sending feedback: " + JSON.stringify(error));
        });
    });
  });

