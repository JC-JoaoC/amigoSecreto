-- Proteções de integridade no próprio banco (defesa em profundidade).
-- Mesmo que algum código da aplicação tenha um bug, o Postgres recusa estados inválidos.

-- 1) Sorteio realizado nunca volta a ficar aberto.
CREATE OR REPLACE FUNCTION laco_guard_draw_update() RETURNS trigger AS $$
BEGIN
  IF OLD.status = 'COMPLETED' AND NEW.status <> 'COMPLETED' THEN
    RAISE EXCEPTION 'Sorteio já realizado não pode ser reaberto'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER draws_guard_update
  BEFORE UPDATE ON "draws"
  FOR EACH ROW EXECUTE FUNCTION laco_guard_draw_update();

-- 2) Um sorteio só fica COMPLETED com resultados completos (1 por participante, mínimo 2).
--    Verificado no COMMIT: impede resultados parciais.
CREATE OR REPLACE FUNCTION laco_check_completed_draw() RETURNS trigger AS $$
DECLARE
  n_participants integer;
  n_results integer;
BEGIN
  IF NEW.status = 'COMPLETED' THEN
    SELECT count(*) INTO n_participants FROM "draw_participants" WHERE draw_id = NEW.id;
    SELECT count(*) INTO n_results FROM "draw_results" WHERE draw_id = NEW.id;
    IF n_participants < 2 OR n_results <> n_participants THEN
      RAISE EXCEPTION 'Sorteio inconsistente: % participantes e % resultados', n_participants, n_results
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER draws_completed_consistency
  AFTER INSERT OR UPDATE ON "draws"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION laco_check_completed_draw();

-- 3) Participantes não podem ser incluídos/removidos depois do sorteio.
--    (Exclusão do sorteio inteiro continua permitida: na cascata o sorteio já não existe.)
CREATE OR REPLACE FUNCTION laco_guard_participants() RETURNS trigger AS $$
DECLARE
  current_status "DrawStatus";
BEGIN
  SELECT status INTO current_status FROM "draws"
    WHERE id = COALESCE(NEW.draw_id, OLD.draw_id);
  IF current_status = 'COMPLETED' THEN
    RAISE EXCEPTION 'Participantes de um sorteio já realizado não podem ser alterados'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER draw_participants_guard
  BEFORE INSERT OR UPDATE OR DELETE ON "draw_participants"
  FOR EACH ROW EXECUTE FUNCTION laco_guard_participants();

-- 4) Resultado só pode apontar para participante do mesmo sorteio e é imutável
--    (apenas revealed_at pode ser preenchido).
CREATE OR REPLACE FUNCTION laco_guard_results() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "draw_participants" p
      WHERE p.id = NEW.participant_id AND p.draw_id = NEW.draw_id
    ) THEN
      RAISE EXCEPTION 'Participante não pertence a este sorteio'
        USING ERRCODE = 'foreign_key_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.draw_id IS DISTINCT FROM OLD.draw_id
     OR NEW.participant_id IS DISTINCT FROM OLD.participant_id
     OR NEW.receiver_cipher IS DISTINCT FROM OLD.receiver_cipher
     OR NEW.receiver_hash IS DISTINCT FROM OLD.receiver_hash THEN
    RAISE EXCEPTION 'Resultados de sorteio são imutáveis'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER draw_results_guard
  BEFORE INSERT OR UPDATE ON "draw_results"
  FOR EACH ROW EXECUTE FUNCTION laco_guard_results();
