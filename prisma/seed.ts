import "dotenv/config";
import { PrismaClient, TransitionAction, RequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "Campus#2026";

async function main() {
  await prisma.attachment.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.task.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.request.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.assetEvent.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.requestType.deleteMany();
  await prisma.workflowTransition.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.counter.deleteMany();

  const hash = await bcrypt.hash(PASSWORD, 10);

  const registrar = await prisma.department.create({ data: { code: "REG", name: "Office of the Registrar" } });
  const finance = await prisma.department.create({ data: { code: "FIN", name: "Finance" } });
  const library = await prisma.department.create({ data: { code: "LIB", name: "Library" } });
  const housing = await prisma.department.create({ data: { code: "HOU", name: "Housing & Accommodation" } });
  const career = await prisma.department.create({ data: { code: "CAR", name: "Career Services" } });
  const it = await prisma.department.create({ data: { code: "IT", name: "Information Technology" } });
  const engineering = await prisma.department.create({ data: { code: "ENG", name: "Faculty of Engineering" } });

  const admin = await prisma.user.create({
    data: {
      name: "Amina Okonkwo",
      email: "admin@nexora.campus",
      passwordHash: hash,
      role: "ADMIN",
      staffTitle: "Director of Operations",
      departmentId: registrar.id,
    },
  });
  const registrarUser = await prisma.user.create({
    data: {
      name: "Daniel Mwangi",
      email: "registrar@nexora.campus",
      passwordHash: hash,
      role: "STAFF",
      staffTitle: "Registrar",
      departmentId: registrar.id,
    },
  });
  const financeUser = await prisma.user.create({
    data: {
      name: "Sofia Almeida",
      email: "finance@nexora.campus",
      passwordHash: hash,
      role: "STAFF",
      staffTitle: "Finance Officer",
      departmentId: finance.id,
    },
  });
  const libraryUser = await prisma.user.create({
    data: {
      name: "Grace Ndlovu",
      email: "library@nexora.campus",
      passwordHash: hash,
      role: "STAFF",
      staffTitle: "Head Librarian",
      departmentId: library.id,
    },
  });
  const housingUser = await prisma.user.create({
    data: {
      name: "Marcus Chen",
      email: "housing@nexora.campus",
      passwordHash: hash,
      role: "STAFF",
      staffTitle: "Housing Coordinator",
      departmentId: housing.id,
    },
  });
  const careerUser = await prisma.user.create({
    data: {
      name: "Leila Haddad",
      email: "career@nexora.campus",
      passwordHash: hash,
      role: "STAFF",
      staffTitle: "Career Advisor",
      departmentId: career.id,
    },
  });
  const student = await prisma.user.create({
    data: {
      name: "Jordan Adeyemi",
      email: "student@nexora.campus",
      passwordHash: hash,
      role: "STUDENT",
      studentId: "STU-2024-118",
      departmentId: engineering.id,
    },
  });
  const student2 = await prisma.user.create({
    data: {
      name: "Priya Raman",
      email: "student2@nexora.campus",
      passwordHash: hash,
      role: "STUDENT",
      studentId: "STU-2023-442",
      departmentId: engineering.id,
    },
  });

  await prisma.department.update({ where: { id: registrar.id }, data: { headId: registrarUser.id } });
  await prisma.department.update({ where: { id: finance.id }, data: { headId: financeUser.id } });
  await prisma.department.update({ where: { id: library.id }, data: { headId: libraryUser.id } });
  await prisma.department.update({ where: { id: housing.id }, data: { headId: housingUser.id } });
  await prisma.department.update({ where: { id: career.id }, data: { headId: careerUser.id } });
  await prisma.department.update({ where: { id: it.id }, data: { headId: admin.id } });
  await prisma.department.update({ where: { id: engineering.id }, data: { headId: admin.id } });

  const transcriptWf = await buildWorkflow("Transcript issuance", "Student request → Registrar → Finance → document generation", [
    { key: "registrar_review", name: "Registrar Review", type: "APPROVAL", departmentId: registrar.id, slaHours: 24 },
    { key: "finance_check", name: "Finance Check", type: "CONDITION", departmentId: finance.id, slaHours: 24 },
    { key: "document_generation", name: "Document Generation", type: "DOCUMENT_GENERATION", assigneeType: "SYSTEM", slaHours: 4 },
  ]);
  await addTransition(transcriptWf.id, null, step(transcriptWf, "registrar_review"), "START");
  await addTransition(transcriptWf.id, step(transcriptWf, "registrar_review"), step(transcriptWf, "finance_check"), "APPROVE");
  await addTransition(transcriptWf.id, step(transcriptWf, "registrar_review"), null, "REJECT", "REJECTED");
  await addTransition(transcriptWf.id, step(transcriptWf, "finance_check"), step(transcriptWf, "document_generation"), "CLEAR");
  await addTransition(transcriptWf.id, step(transcriptWf, "finance_check"), null, "OUTSTANDING", "REJECTED");
  await addTransition(transcriptWf.id, step(transcriptWf, "document_generation"), null, "COMPLETE", "COMPLETED");

  const clearanceWf = await buildWorkflow("Student clearance", "Department, library, finance, then registry", [
    { key: "department_clearance", name: "Department Clearance", type: "APPROVAL", departmentId: engineering.id, slaHours: 24 },
    { key: "library_clearance", name: "Library Clearance", type: "APPROVAL", departmentId: library.id, slaHours: 24 },
    { key: "finance_clearance", name: "Finance Clearance", type: "CONDITION", departmentId: finance.id, slaHours: 24 },
    { key: "registry_complete", name: "Registry Completion", type: "TASK", departmentId: registrar.id, slaHours: 12 },
  ]);
  await chainApprovals(clearanceWf, ["department_clearance", "library_clearance", "finance_clearance", "registry_complete"]);

  const recWf = await buildWorkflow("Recommendation letter", "Advisor then dean, then letter generation", [
    { key: "advisor_review", name: "Advisor Review", type: "APPROVAL", departmentId: engineering.id, slaHours: 48 },
    { key: "dean_review", name: "Dean Review", type: "APPROVAL", departmentId: registrar.id, slaHours: 48 },
    { key: "letter_generation", name: "Document Generation", type: "DOCUMENT_GENERATION", assigneeType: "SYSTEM", slaHours: 4 },
  ]);
  await chainApprovals(recWf, ["advisor_review", "dean_review", "letter_generation"]);

  const internWf = await buildWorkflow("Internship letter", "Career office then document generation", [
    { key: "career_review", name: "Career Office Review", type: "APPROVAL", departmentId: career.id, slaHours: 48 },
    { key: "letter_generation", name: "Document Generation", type: "DOCUMENT_GENERATION", assigneeType: "SYSTEM", slaHours: 4 },
  ]);
  await chainApprovals(internWf, ["career_review", "letter_generation"]);

  const housingWf = await buildWorkflow("Accommodation request", "Housing office review", [
    { key: "housing_review", name: "Housing Review", type: "APPROVAL", departmentId: housing.id, slaHours: 72 },
  ]);
  await chainApprovals(housingWf, ["housing_review"]);

  const equipmentWf = await buildWorkflow("Equipment request", "Department then IT stores", [
    { key: "department_head", name: "Department Head Approval", type: "APPROVAL", departmentId: engineering.id, slaHours: 24 },
    { key: "stores", name: "IT Stores Fulfilment", type: "TASK", departmentId: it.id, slaHours: 48 },
  ]);
  await chainApprovals(equipmentWf, ["department_head", "stores"]);

  const types = {
    transcript: await prisma.requestType.create({
      data: {
        code: "TRANSCRIPT",
        name: "Transcript Request",
        description: "Official academic transcript",
        workflowId: transcriptWf.id,
        slaHours: 48,
        formSchema: { purpose: "string", copies: "number" },
      },
    }),
    clearance: await prisma.requestType.create({
      data: { code: "CLEARANCE", name: "Clearance Request", workflowId: clearanceWf.id, slaHours: 96 },
    }),
    recommendation: await prisma.requestType.create({
      data: { code: "RECOMMENDATION", name: "Recommendation Letter", workflowId: recWf.id, slaHours: 120 },
    }),
    internship: await prisma.requestType.create({
      data: { code: "INTERNSHIP", name: "Internship Letter", workflowId: internWf.id, slaHours: 72 },
    }),
    accommodation: await prisma.requestType.create({
      data: { code: "ACCOMMODATION", name: "Accommodation Request", workflowId: housingWf.id, slaHours: 72 },
    }),
    equipment: await prisma.requestType.create({
      data: { code: "EQUIPMENT", name: "Equipment Request", workflowId: equipmentWf.id, slaHours: 72 },
    }),
  };

  await prisma.asset.createMany({
    data: [
      { tag: "LT-0012", name: "Laptop", category: "Computing", status: "ASSIGNED", departmentId: engineering.id, assigneeId: student.id },
      { tag: "PR-0021", name: "Projector", category: "AV", status: "IN_STOCK", departmentId: it.id },
      { tag: "PR-0081", name: "Printer", category: "Office", status: "MAINTENANCE", departmentId: registrar.id },
      { tag: "SV-0032", name: "Server", category: "Infrastructure", status: "IN_STOCK", departmentId: it.id },
    ],
  });

  const now = Date.now();
  const hours = (h: number) => new Date(now - h * 3600000);

  const liveTranscript = await prisma.request.create({
    data: {
      number: "REQ-1042",
      typeId: types.transcript.id,
      status: "PENDING_APPROVAL",
      priority: "NORMAL",
      requesterId: student.id,
      departmentId: registrar.id,
      assignedOfficerId: registrarUser.id,
      currentApproverId: registrarUser.id,
      currentStepId: step(transcriptWf, "registrar_review"),
      formData: { purpose: "Graduate application", copies: 2 },
      submittedAt: hours(8),
      dueAt: new Date(now + 16 * 3600000),
      events: {
        create: [
          { actorId: student.id, action: "created", message: "Jordan Adeyemi created REQ-1042", createdAt: hours(8.2) },
          { actorId: student.id, action: "submitted", message: "Jordan Adeyemi submitted request REQ-1042", createdAt: hours(8) },
          { actorId: registrarUser.id, action: "step.entered", message: "Registrar Review started — assigned to Daniel Mwangi", createdAt: hours(8) },
        ],
      },
      tasks: {
        create: {
          stepId: step(transcriptWf, "registrar_review"),
          assigneeId: registrarUser.id,
          kind: "APPROVAL",
          title: "Registrar Review · REQ-1042",
          dueAt: new Date(now + 16 * 3600000),
        },
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: registrarUser.id,
      type: "APPROVAL_ASSIGNED",
      title: "New approval: REQ-1042",
      body: "Transcript Request needs Registrar Review.",
      link: `/app/requests/${liveTranscript.id}`,
    },
  });

  const financeHold = await prisma.request.create({
    data: {
      number: "REQ-1043",
      typeId: types.transcript.id,
      status: "UNDER_REVIEW",
      requesterId: student2.id,
      departmentId: finance.id,
      assignedOfficerId: financeUser.id,
      currentStepId: step(transcriptWf, "finance_check"),
      formData: { purpose: "Job application" },
      submittedAt: hours(30),
      dueAt: new Date(now + 10 * 3600000),
      events: {
        create: [
          { actorId: student2.id, action: "submitted", message: "Priya Raman submitted request REQ-1043", createdAt: hours(30) },
          { actorId: registrarUser.id, action: "approve", message: "Daniel Mwangi recorded approve at Registrar Review", createdAt: hours(20) },
          { actorId: financeUser.id, action: "step.entered", message: "Finance Check started — assigned to Sofia Almeida", createdAt: hours(20) },
        ],
      },
      tasks: {
        create: {
          stepId: step(transcriptWf, "finance_check"),
          assigneeId: financeUser.id,
          kind: "ACTION",
          title: "Finance Check · REQ-1043",
          dueAt: new Date(now + 10 * 3600000),
        },
      },
    },
  });

  await prisma.request.create({
    data: {
      number: "REQ-1030",
      typeId: types.transcript.id,
      status: "COMPLETED",
      requesterId: student.id,
      formData: { purpose: "Visa" },
      submittedAt: hours(240),
      completedAt: hours(180),
      events: {
        create: [
          { actorId: student.id, action: "submitted", message: "Jordan Adeyemi submitted request REQ-1030", createdAt: hours(240) },
          { actorId: registrarUser.id, action: "approve", message: "Daniel Mwangi recorded approve at Registrar Review", createdAt: hours(220) },
          { actorId: financeUser.id, action: "clear", message: "Sofia Almeida recorded clear at Finance Check", createdAt: hours(190) },
          { action: "document.generated", message: "Document generation started and completed for REQ-1030", createdAt: hours(180) },
          { action: "completed", message: "REQ-1030 completed", createdAt: hours(180) },
        ],
      },
    },
  });

  await prisma.request.create({
    data: {
      number: "REQ-1048",
      typeId: types.accommodation.id,
      status: "PENDING_APPROVAL",
      priority: "HIGH",
      requesterId: student.id,
      departmentId: housing.id,
      assignedOfficerId: housingUser.id,
      currentApproverId: housingUser.id,
      currentStepId: step(housingWf, "housing_review"),
      formData: { hall: "East Residence", reason: "Exchange semester" },
      submittedAt: hours(50),
      dueAt: new Date(now - 2 * 3600000),
      slaBreachedAt: new Date(now - 2 * 3600000),
      events: {
        create: [
          { actorId: student.id, action: "submitted", message: "Jordan Adeyemi submitted request REQ-1048", createdAt: hours(50) },
          { action: "sla.breached", message: "SLA breached at Housing Review — escalated to Marcus Chen", createdAt: hours(2) },
        ],
      },
      tasks: {
        create: {
          stepId: step(housingWf, "housing_review"),
          assigneeId: housingUser.id,
          kind: "APPROVAL",
          title: "Housing Review · REQ-1048",
          dueAt: new Date(now - 2 * 3600000),
        },
      },
    },
  });

  for (let i = 0; i < 18; i++) {
    const submittedAt = hours(40 + i * 18);
    const completedAt = new Date(submittedAt.getTime() + (36 + (i % 5) * 8) * 3600000);
    await prisma.request.create({
      data: {
        number: `REQ-${1000 + i}`,
        typeId: [types.transcript.id, types.internship.id, types.recommendation.id, types.clearance.id][i % 4],
        status: "COMPLETED",
        requesterId: i % 2 === 0 ? student.id : student2.id,
        formData: { seeded: true },
        submittedAt,
        completedAt,
      },
    });
  }

  await prisma.counter.create({ data: { key: "request", value: 1100 } });
  await prisma.auditLog.createMany({
    data: [
      { userId: student.id, action: "request.submitted", resource: `request:${liveTranscript.id}` },
      { userId: registrarUser.id, action: "request.approve", resource: `request:${financeHold.id}` },
      { userId: admin.id, action: "user.login", resource: `user:${admin.id}` },
    ],
  });

  console.log("Seeded Nexora Campus");
  console.log("Demo login password: Campus#2026");
  console.log("  student@nexora.campus   (student)");
  console.log("  registrar@nexora.campus (staff)");
  console.log("  finance@nexora.campus   (staff)");
  console.log("  admin@nexora.campus     (admin)");
}

type StepInput = {
  key: string;
  name: string;
  type: "APPROVAL" | "TASK" | "CONDITION" | "DOCUMENT_GENERATION" | "NOTIFY";
  departmentId?: string;
  assigneeType?: "DEPARTMENT" | "ROLE" | "REQUESTER" | "SYSTEM";
  slaHours?: number;
};

async function buildWorkflow(name: string, description: string, steps: StepInput[]) {
  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      steps: {
        create: steps.map((s, i) => ({
          key: s.key,
          name: s.name,
          type: s.type,
          assigneeType: s.assigneeType ?? (s.type === "DOCUMENT_GENERATION" ? "SYSTEM" : "DEPARTMENT"),
          departmentId: s.departmentId,
          slaHours: s.slaHours,
          sortOrder: i + 1,
        })),
      },
    },
    include: { steps: true },
  });
  return workflow;
}

function step(workflow: { steps: { id: string; key: string }[] }, key: string) {
  const found = workflow.steps.find((s) => s.key === key);
  if (!found) throw new Error(`Missing step ${key}`);
  return found.id;
}

async function addTransition(
  workflowId: string,
  fromStepId: string | null,
  toStepId: string | null,
  action: TransitionAction,
  toStatus?: RequestStatus
) {
  await prisma.workflowTransition.create({
    data: { workflowId, fromStepId, toStepId, action, toStatus },
  });
}

async function chainApprovals(
  workflow: { id: string; steps: { id: string; key: string; type: string }[] },
  keys: string[]
) {
  await addTransition(workflow.id, null, step(workflow, keys[0]), "START");
  for (let i = 0; i < keys.length; i++) {
    const current = workflow.steps.find((s) => s.key === keys[i])!;
    const nextId = i < keys.length - 1 ? step(workflow, keys[i + 1]) : null;
    const success: TransitionAction = current.type === "CONDITION" ? "CLEAR" : current.type === "APPROVAL" ? "APPROVE" : "COMPLETE";
    await addTransition(workflow.id, current.id, nextId, success, nextId ? undefined : "COMPLETED");
    if (current.type === "APPROVAL") {
      await addTransition(workflow.id, current.id, null, "REJECT", "REJECTED");
    }
    if (current.type === "CONDITION") {
      await addTransition(workflow.id, current.id, null, "OUTSTANDING", "REJECTED");
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
