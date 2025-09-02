interface User {
  id: string;
  name: string;
  title: string;
  company: string;
  location: string;
  bio: string;
  avatar: string;
  preferences: {
    mentor: boolean;
    invest: boolean;
    discuss: boolean;
    collaborate: boolean;
    hire: boolean;
  };
  skills?: string[];
  interests?: string[];
  connections: number;
}

interface Match {
  user: User;
  compatibilityScore: number;
  matchReasons: string[];
  sharedInterests: string[];
  complementarySkills: string[];
}

export class MatchingAlgorithm {
  findMatches(currentUser: User, allUsers: User[]): Match[] {
    const matches: Match[] = [];

    for (const user of allUsers) {
      if (user.id === currentUser.id) continue;

      const match = this.calculateMatch(currentUser, user);
      if (match.compatibilityScore > 30) {
        // Only include matches above 30% compatibility
        matches.push(match);
      }
    }

    // Sort by compatibility score (highest first)
    return matches.sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  }

  private calculateMatch(currentUser: User, targetUser: User): Match {
    let score = 0;
    const matchReasons: string[] = [];
    const sharedInterests: string[] = [];
    const complementarySkills: string[] = [];

    // 1. Collaboration Preference Matching (40% weight)
    const preferenceScore = this.calculatePreferenceCompatibility(
      currentUser,
      targetUser,
      matchReasons
    );
    score += preferenceScore * 0.4;

    // 2. Location Proximity (20% weight)
    const locationScore = this.calculateLocationCompatibility(
      currentUser,
      targetUser,
      matchReasons
    );
    score += locationScore * 0.2;

    // 3. Shared Interests (20% weight)
    const interestScore = this.calculateInterestCompatibility(
      currentUser,
      targetUser,
      sharedInterests,
      matchReasons
    );
    score += interestScore * 0.2;

    // 4. Complementary Skills (10% weight)
    const skillScore = this.calculateSkillCompatibility(
      currentUser,
      targetUser,
      complementarySkills,
      matchReasons
    );
    score += skillScore * 0.1;

    // 5. Company/Industry Alignment (10% weight)
    const companyScore = this.calculateCompanyCompatibility(
      currentUser,
      targetUser,
      matchReasons
    );
    score += companyScore * 0.1;

    return {
      user: targetUser,
      compatibilityScore: Math.round(score),
      matchReasons,
      sharedInterests,
      complementarySkills,
    };
  }

  private calculatePreferenceCompatibility(
    currentUser: User,
    targetUser: User,
    reasons: string[]
  ): number {
    let score = 0;
    let matches = 0;

    // Mentorship matching (mentor + mentee)
    if (currentUser.preferences.mentor && !targetUser.preferences.mentor) {
      score += 25;
      matches++;
      reasons.push("You can mentor them in your expertise area");
    }
    if (!currentUser.preferences.mentor && targetUser.preferences.mentor) {
      score += 25;
      matches++;
      reasons.push("They can mentor you and share their experience");
    }

    // Investment matching (investor + entrepreneur)
    if (currentUser.preferences.invest && !targetUser.preferences.invest) {
      score += 20;
      matches++;
      reasons.push("Potential investment opportunity");
    }
    if (!currentUser.preferences.invest && targetUser.preferences.invest) {
      score += 20;
      matches++;
      reasons.push("They might be interested in investing in your projects");
    }

    // Collaboration matching (both want to collaborate)
    if (
      currentUser.preferences.collaborate &&
      targetUser.preferences.collaborate
    ) {
      score += 20;
      matches++;
      reasons.push("Both interested in collaboration opportunities");
    }

    // Hiring matching (employer + candidate)
    if (currentUser.preferences.hire && !targetUser.preferences.hire) {
      score += 15;
      matches++;
      reasons.push("Potential hiring opportunity");
    }
    if (!currentUser.preferences.hire && targetUser.preferences.hire) {
      score += 15;
      matches++;
      reasons.push("They might have job opportunities for you");
    }

    // Discussion matching (both enjoy professional discussions)
    if (currentUser.preferences.discuss && targetUser.preferences.discuss) {
      score += 10;
      matches++;
      reasons.push("Both enjoy professional discussions");
    }

    return Math.min(score, 100); // Cap at 100
  }

  private calculateLocationCompatibility(
    currentUser: User,
    targetUser: User,
    reasons: string[]
  ): number {
    if (currentUser.location === targetUser.location) {
      reasons.push("Located in the same area for potential in-person meetings");
      return 100;
    }

    // Check if same state/region (basic heuristic)
    const currentState = currentUser.location.split(", ").pop();
    const targetState = targetUser.location.split(", ").pop();

    if (currentState === targetState) {
      reasons.push("Located in the same state/region");
      return 60;
    }

    return 20; // Different regions but still possible to connect virtually
  }

  private calculateInterestCompatibility(
    currentUser: User,
    targetUser: User,
    sharedInterests: string[],
    reasons: string[]
  ): number {
    if (!currentUser.interests || !targetUser.interests) return 20;

    const currentInterests = new Set(currentUser.interests);
    const shared = targetUser.interests.filter((interest) =>
      currentInterests.has(interest)
    );

    sharedInterests.push(...shared);

    if (shared.length === 0) return 20;

    const score = Math.min(
      (shared.length /
        Math.max(currentUser.interests.length, targetUser.interests.length)) *
        100,
      100
    );

    if (shared.length > 0) {
      reasons.push(`Shared interests in ${shared.slice(0, 2).join(", ")}`);
    }

    return score;
  }

  private calculateSkillCompatibility(
    currentUser: User,
    targetUser: User,
    complementarySkills: string[],
    reasons: string[]
  ): number {
    if (!currentUser.skills || !targetUser.skills) return 20;

    const currentSkills = new Set(currentUser.skills);
    const complementary = targetUser.skills.filter(
      (skill) => !currentSkills.has(skill)
    );

    complementarySkills.push(...complementary.slice(0, 3));

    if (complementary.length > 0) {
      reasons.push(
        `Complementary skills in ${complementary.slice(0, 2).join(", ")}`
      );
      return Math.min(
        (complementary.length / targetUser.skills.length) * 100,
        100
      );
    }

    return 20;
  }

  private calculateCompanyCompatibility(
    currentUser: User,
    targetUser: User,
    reasons: string[]
  ): number {
    if (currentUser.company === targetUser.company) {
      reasons.push("Works at the same company");
      return 100;
    }

    // Check for similar company types (basic heuristic)
    const currentCompanyType = this.getCompanyType(currentUser.company);
    const targetCompanyType = this.getCompanyType(targetUser.company);

    if (currentCompanyType === targetCompanyType) {
      reasons.push(`Both work in ${currentCompanyType} companies`);
      return 60;
    }

    return 20;
  }

  private getCompanyType(companyName: string): string {
    const name = companyName.toLowerCase();
    if (
      name.includes("tech") ||
      name.includes("software") ||
      name.includes("startup")
    )
      return "tech";
    if (
      name.includes("design") ||
      name.includes("creative") ||
      name.includes("agency")
    )
      return "design";
    if (
      name.includes("consulting") ||
      name.includes("advisory") ||
      name.includes("partners")
    )
      return "consulting";
    if (
      name.includes("capital") ||
      name.includes("ventures") ||
      name.includes("investment")
    )
      return "investment";
    return "other";
  }
}
