import { Component } from '@angular/core';

export interface TeamMember {
  name: string;
  role: string;
  image: string;
  email: string;
}

@Component({
  selector: 'app-developing-team',
  templateUrl: './developing-team.component.html',
  styleUrls: ['./developing-team.component.scss']
})
export class DevelopingTeamComponent {
  teamMembers: TeamMember[] = [
    {
      name: 'Amine Mokhtar',
      role: 'Backend developper',
      image: 'assets/DeveloppingTeam/Amine_Mokhtar.png',
      email: 'amine.mokhtar@esprit.tn'
    },
    {
      name: 'Feriel Khamlia',
      role: 'Team Leader',
      image: 'assets/DeveloppingTeam/Feriel_Khamlia.png',
      email: 'feriel.khamlia@esprit.tn'
    },
    {
      name: 'Ibtissem Ben Amara',
      role: 'Infrastructure manager',
      image: 'assets/DeveloppingTeam/Ibtissem_Ben_Amara.png',
      email: 'ibtissem.benamara@esprit.tn'
    },
    {
      name: 'Louay Tlili',
      role: 'Frontend developper',
      image: 'assets/DeveloppingTeam/Louay_Tlili.jpg',
      email: 'louay.tlili@example.com'
    },
    {
      name: 'Louay Zorai',
      role: 'Frontend developper',
      image: 'assets/DeveloppingTeam/Louay_Zorai.png',
      email: 'louay.zorai@esprit.tn'
    },
    {
      name: 'Koussay Akchi',
      role: 'DevOps Engineer',
      image: 'assets/DeveloppingTeam/Koussay_Akchi.png',
      email: 'koussay.akchi@esprit.tn'
    },
    {
      name: 'Louay Tlili',
      role: 'Database Architect',
      image: 'assets/DeveloppingTeam/Louay_Tlili.png',
      email: 'louay.tlili@esprit.tn'
    },
    {
      name: 'Jihen Ghabi',
      role: 'UI/UX Designer',
      image: 'assets/DeveloppingTeam/Jihen_Ghabi.png',
      email: 'jihen.ghabi@esprit.tn'
    }
  ];
}
