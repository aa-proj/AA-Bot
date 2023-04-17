
// store the nickname of the user
import {Column, Entity, PrimaryGeneratedColumn} from "typeorm";

@Entity("NickNameLog")
export class NickNameLog {
  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Column({type: "varchar", length: 256})
  userId!: string;

  @Column({type: "varchar", length: 256})
  payUserId!: string;

  @Column({type: "varchar", length: 256})
  nickname!: string;

  @Column({type: "varchar", length: 256, nullable: true})
  beforeNickname!: string | null;

  @Column({type: "int"})
  createAt!: number;

  @Column({type: "boolean", default: false})
  isExpired!: boolean;
}
