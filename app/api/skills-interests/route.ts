import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get all skills from users and count their occurrences
    const { data: skillsData, error: skillsError } = await supabase
      .from("users")
      .select("skills")
      .not("skills", "is", null);

    if (skillsError) {
      console.error("Error fetching skills:", skillsError);
      return NextResponse.json(
        { error: "Failed to fetch skills" },
        { status: 500 }
      );
    }

    // Get all interests from users and count their occurrences
    const { data: interestsData, error: interestsError } = await supabase
      .from("users")
      .select("interests")
      .not("interests", "is", null);

    if (interestsError) {
      console.error("Error fetching interests:", interestsError);
      return NextResponse.json(
        { error: "Failed to fetch interests" },
        { status: 500 }
      );
    }

    // Count skills occurrences
    const skillsCount: { [key: string]: number } = {};
    skillsData?.forEach((user) => {
      if (user.skills && Array.isArray(user.skills)) {
        user.skills.forEach((skill: string) => {
          skillsCount[skill] = (skillsCount[skill] || 0) + 1;
        });
      }
    });

    // Count interests occurrences
    const interestsCount: { [key: string]: number } = {};
    interestsData?.forEach((user) => {
      if (user.interests && Array.isArray(user.interests)) {
        user.interests.forEach((interest: string) => {
          interestsCount[interest] = (interestsCount[interest] || 0) + 1;
        });
      }
    });

    // Convert to array format and sort by count
    const skills = Object.entries(skillsCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const interests = Object.entries(interestsCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // If no data exists, return default popular options
    const defaultSkills = [
      { name: "JavaScript", count: 0 },
      { name: "React", count: 0 },
      { name: "Node.js", count: 0 },
      { name: "Python", count: 0 },
      { name: "TypeScript", count: 0 },
      { name: "Java", count: 0 },
      { name: "C++", count: 0 },
      { name: "SQL", count: 0 },
      { name: "AWS", count: 0 },
      { name: "Docker", count: 0 },
      { name: "Git", count: 0 },
      { name: "MongoDB", count: 0 },
      { name: "PostgreSQL", count: 0 },
      { name: "Vue.js", count: 0 },
      { name: "Angular", count: 0 },
      { name: "Express.js", count: 0 },
      { name: "GraphQL", count: 0 },
      { name: "Redis", count: 0 },
      { name: "Kubernetes", count: 0 },
      { name: "Machine Learning", count: 0 },
      { name: "Data Analysis", count: 0 },
      { name: "UI/UX Design", count: 0 },
      { name: "Product Management", count: 0 },
      { name: "Project Management", count: 0 },
      { name: "Marketing", count: 0 },
      { name: "Sales", count: 0 },
      { name: "Business Development", count: 0 },
      { name: "Strategy", count: 0 },
      { name: "Leadership", count: 0 },
      { name: "Team Management", count: 0 }
    ];

    const defaultInterests = [
      { name: "AI/ML", count: 0 },
      { name: "Fintech", count: 0 },
      { name: "SaaS", count: 0 },
      { name: "Web Development", count: 0 },
      { name: "Mobile Development", count: 0 },
      { name: "Cloud Computing", count: 0 },
      { name: "Blockchain", count: 0 },
      { name: "Cybersecurity", count: 0 },
      { name: "Data Science", count: 0 },
      { name: "DevOps", count: 0 },
      { name: "Open Source", count: 0 },
      { name: "Startup", count: 0 },
      { name: "Enterprise Software", count: 0 },
      { name: "E-commerce", count: 0 },
      { name: "EdTech", count: 0 },
      { name: "HealthTech", count: 0 },
      { name: "Gaming", count: 0 },
      { name: "IoT", count: 0 },
      { name: "AR/VR", count: 0 },
      { name: "Robotics", count: 0 },
      { name: "Networking", count: 0 },
      { name: "Mentoring", count: 0 },
      { name: "Investing", count: 0 },
      { name: "Product Strategy", count: 0 },
      { name: "Growth Hacking", count: 0 },
      { name: "Content Creation", count: 0 },
      { name: "Digital Marketing", count: 0 },
      { name: "Brand Building", count: 0 },
      { name: "Customer Success", count: 0 },
      { name: "Innovation", count: 0 }
    ];

    return NextResponse.json({
      skills: skills.length > 0 ? skills : defaultSkills,
      interests: interests.length > 0 ? interests : defaultInterests,
    });
  } catch (error) {
    console.error("Error in skills-interests API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
