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
      email: 'amine.mokhtar@example.com'
    },
    {
      name: 'Feriel Khamlia',
      role: 'Team Leader',
      image: 'assets/DeveloppingTeam/Feriel_Khamlia.png',
      email: 'feriel.khamlia@example.com'
    },
    {
      name: 'Ibtissem Ben Amara',
      role: 'Infrastructure manager',
      image: 'assets/DeveloppingTeam/Ibtissem_Ben_Amara.png',
      email: 'ibtissem.benamara@example.com'
    },
    {
      name: 'Louay Zorai',
      role: 'Frontend developper',
      image: 'assets/DeveloppingTeam/Louay_Zorai.png',
      email: 'louay.zorai@example.com'
    }
  ];
}
